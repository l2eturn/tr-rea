#include "AI/ORBotController.h"

#include "Character/ORCharacter.h"
#include "Character/ORCharacterMovementComponent.h"
#include "Components/CapsuleComponent.h"
#include "Game/ORGameState.h"

AORBotController::AORBotController()
{
	PrimaryActorTick.bCanEverTick = true;
	bWantsPlayerState = true;
}

bool AORBotController::HasFloorAhead(const AORCharacter* Racer, float Distance) const
{
	if (!Racer)
	{
		return true;
	}

	const FVector Origin = Racer->GetActorLocation() + FVector(Distance, 0.f, 0.f);
	const FVector End = Origin - FVector(0.f, 0.f, 400.f);

	FHitResult Hit;
	FCollisionQueryParams Params;
	Params.AddIgnoredActor(Racer);

	return GetWorld()->LineTraceSingleByChannel(Hit, Origin, End, ECC_Visibility, Params);
}

bool AORBotController::IsBlockedAhead(const AORCharacter* Racer, float Distance) const
{
	if (!Racer)
	{
		return false;
	}

	// Trace at chest height: a wall or a hazard block will stop us here.
	const FVector Origin = Racer->GetActorLocation() + FVector(0.f, 0.f, 20.f);
	const FVector End = Origin + FVector(Distance, 0.f, 0.f);

	FHitResult Hit;
	FCollisionQueryParams Params;
	Params.AddIgnoredActor(Racer);

	return GetWorld()->LineTraceSingleByChannel(Hit, Origin, End, ECC_Visibility, Params);
}

bool AORBotController::IsCeilingAhead(const AORCharacter* Racer, float Distance) const
{
	if (!Racer)
	{
		return false;
	}

	const float HalfHeight = Racer->GetCapsuleComponent()->GetScaledCapsuleHalfHeight();

	// A low ceiling blocks the head but leaves the knees clear, so compare a
	// high trace against a low one.
	const FVector High = Racer->GetActorLocation() + FVector(0.f, 0.f, HalfHeight * 0.65f);
	const FVector Low = Racer->GetActorLocation() - FVector(0.f, 0.f, HalfHeight * 0.4f);

	FHitResult HitHigh, HitLow;
	FCollisionQueryParams Params;
	Params.AddIgnoredActor(Racer);

	const bool bHighBlocked = GetWorld()->LineTraceSingleByChannel(
		HitHigh, High, High + FVector(Distance, 0.f, 0.f), ECC_Visibility, Params);
	const bool bLowBlocked = GetWorld()->LineTraceSingleByChannel(
		HitLow, Low, Low + FVector(Distance, 0.f, 0.f), ECC_Visibility, Params);

	return bHighBlocked && !bLowBlocked;
}

void AORBotController::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);

	AORCharacter* Racer = Cast<AORCharacter>(GetPawn());
	if (!Racer)
	{
		return;
	}

	const AORGameState* GS = GetWorld() ? GetWorld()->GetGameState<AORGameState>() : nullptr;
	if (!GS || GS->RacePhase != ERacePhase::Running)
	{
		return;
	}

	if (Racer->IsStunned())
	{
		return;
	}

	if (JumpCooldown > 0.f)
	{
		JumpCooldown = FMath::Max(0.f, JumpCooldown - DeltaSeconds);
	}

	const UORCharacterMovementComponent* Move = Racer->GetORMovement();
	const float Speed = Move ? Move->Velocity.Size2D() : 0.f;
	const float Look = BaseLookAhead + Speed * 0.35f;

	// Slide under a low ceiling. Keep holding it until the body is clear,
	// which is what the engine's UnCrouch ceiling check relies on.
	if (IsCeilingAhead(Racer, Look * 0.8f))
	{
		Racer->MoveRight(1.f);
		Racer->StartSliding();
		return;
	}
	Racer->StopSliding();

	bool bWantJump = false;

	if (!HasFloorAhead(Racer, Look))
	{
		bWantJump = true;
	}
	else if (IsBlockedAhead(Racer, Look * 0.5f))
	{
		bWantJump = true;
	}
	else if (Move && Move->IsFalling() && Move->Velocity.Z < -120.f
		&& !HasFloorAhead(Racer, Look * 0.4f))
	{
		// Falling short of the next platform: spend the second jump.
		bWantJump = true;
	}

	// Weaker bots occasionally miss the input entirely.
	const bool bMiss = FMath::FRand() > Skill;

	if (bWantJump && !bMiss && JumpCooldown <= 0.f)
	{
		Racer->Jump();
		// Release on the next decision so the double jump stays available.
		JumpCooldown = 0.12f;
	}
	else
	{
		Racer->StopJumping();
	}

	// Throttle, with weaker bots easing off now and then.
	Racer->MoveRight(bMiss ? 0.65f : 1.f);
}
