#include "Character/ORCharacterMovementComponent.h"

#include "GameFramework/Character.h"

// ---------------------------------------------------------------------------
// FSavedMove_OR
// ---------------------------------------------------------------------------

UORCharacterMovementComponent::FSavedMove_OR::FSavedMove_OR()
	: bSavedWantsToSlide(0)
	, SavedBoostRemaining(0.f)
{
}

void UORCharacterMovementComponent::FSavedMove_OR::Clear()
{
	Super::Clear();
	bSavedWantsToSlide = 0;
	SavedBoostRemaining = 0.f;
}

uint8 UORCharacterMovementComponent::FSavedMove_OR::GetCompressedFlags() const
{
	uint8 Result = Super::GetCompressedFlags();
	if (bSavedWantsToSlide)
	{
		Result |= FLAG_Custom_0;
	}
	return Result;
}

bool UORCharacterMovementComponent::FSavedMove_OR::CanCombineWith(
	const FSavedMovePtr& NewMove, ACharacter* InCharacter, float MaxDelta) const
{
	const FSavedMove_OR* New = static_cast<const FSavedMove_OR*>(NewMove.Get());

	// Never merge across a change in our own predicted state, or the merged
	// move would replay with the wrong intent.
	if (bSavedWantsToSlide != New->bSavedWantsToSlide)
	{
		return false;
	}
	if (!FMath::IsNearlyEqual(SavedBoostRemaining, New->SavedBoostRemaining, 1.f))
	{
		return false;
	}

	return Super::CanCombineWith(NewMove, InCharacter, MaxDelta);
}

void UORCharacterMovementComponent::FSavedMove_OR::SetMoveFor(
	ACharacter* C, float InDeltaTime, FVector const& NewAccel,
	FNetworkPredictionData_Client_Character& ClientData)
{
	Super::SetMoveFor(C, InDeltaTime, NewAccel, ClientData);

	if (const UORCharacterMovementComponent* Move =
		Cast<UORCharacterMovementComponent>(C->GetCharacterMovement()))
	{
		bSavedWantsToSlide = Move->bWantsToSlide;
		SavedBoostRemaining = Move->BoostRemaining;
	}
}

void UORCharacterMovementComponent::FSavedMove_OR::PrepMoveFor(ACharacter* C)
{
	Super::PrepMoveFor(C);

	if (UORCharacterMovementComponent* Move =
		Cast<UORCharacterMovementComponent>(C->GetCharacterMovement()))
	{
		Move->bWantsToSlide = bSavedWantsToSlide;
		Move->BoostRemaining = SavedBoostRemaining;
	}
}

// ---------------------------------------------------------------------------
// FNetworkPredictionData_Client_OR
// ---------------------------------------------------------------------------

UORCharacterMovementComponent::FNetworkPredictionData_Client_OR::FNetworkPredictionData_Client_OR(
	const UCharacterMovementComponent& ClientMovement)
	: Super(ClientMovement)
{
}

FSavedMovePtr UORCharacterMovementComponent::FNetworkPredictionData_Client_OR::AllocateNewMove()
{
	return FSavedMovePtr(new FSavedMove_OR());
}

// ---------------------------------------------------------------------------
// UORCharacterMovementComponent
// ---------------------------------------------------------------------------

UORCharacterMovementComponent::UORCharacterMovementComponent()
	: bWantsToSlide(0)
	, bIsSliding(0)
{
	// The slide rides on the crouch system, so crouching must be allowed.
	NavAgentProps.bCanCrouch = true;
	bCanWalkOffLedgesWhenCrouching = true;

	MaxWalkSpeed = 820.f;
	MaxWalkSpeedCrouched = SlideMaxSpeed;
	MaxAcceleration = 2600.f;
	BrakingDecelerationWalking = 2048.f;
	GroundFriction = 8.f;
	JumpZVelocity = 760.f;
	AirControl = 0.45f;
	GravityScale = 1.9f;

	// Two jumps, as in the prototype. The owning Character sets JumpMaxCount.
	SetWalkableFloorAngle(50.f);
}

void UORCharacterMovementComponent::InitializeComponent()
{
	Super::InitializeComponent();

	CachedGroundFriction = GroundFriction;
	CachedBrakingDeceleration = BrakingDecelerationWalking;
}

FNetworkPredictionData_Client* UORCharacterMovementComponent::GetPredictionData_Client() const
{
	if (ClientPredictionData == nullptr)
	{
		UORCharacterMovementComponent* Mutable = const_cast<UORCharacterMovementComponent*>(this);
		Mutable->ClientPredictionData = new FNetworkPredictionData_Client_OR(*this);
	}
	return ClientPredictionData;
}

void UORCharacterMovementComponent::UpdateFromCompressedFlags(uint8 Flags)
{
	Super::UpdateFromCompressedFlags(Flags);

	// This is how the server learns the client wanted to slide.
	bWantsToSlide = (Flags & FLAG_Custom_0) != 0;
}

void UORCharacterMovementComponent::SetWantsToSlide(bool bWants)
{
	bWantsToSlide = bWants ? 1 : 0;
}

bool UORCharacterMovementComponent::IsSliding() const
{
	return bIsSliding != 0;
}

void UORCharacterMovementComponent::AddBoost(float Amount)
{
	BoostRemaining = FMath::Clamp(BoostRemaining + Amount, 0.f, MaxBoost);
}

bool UORCharacterMovementComponent::CanStartSlide() const
{
	if (!IsMovingOnGround())
	{
		return false;
	}
	// Needs some speed to slide on, otherwise it is just crouching.
	return Velocity.SizeSquared2D() > FMath::Square(SlideMinSpeed);
}

void UORCharacterMovementComponent::StartSlide()
{
	if (bIsSliding)
	{
		return;
	}

	bIsSliding = 1;

	GroundFriction = SlideGroundFriction;
	BrakingDecelerationWalking = SlideBrakingDeceleration;
	MaxWalkSpeedCrouched = SlideMaxSpeed;

	// One-off impulse along the current heading.
	const FVector Dir = Velocity.GetSafeNormal2D();
	if (!Dir.IsNearlyZero())
	{
		Velocity += Dir * SlideEnterImpulse;
	}
}

void UORCharacterMovementComponent::StopSlide()
{
	if (!bIsSliding)
	{
		return;
	}

	bIsSliding = 0;

	GroundFriction = CachedGroundFriction;
	BrakingDecelerationWalking = CachedBrakingDeceleration;
}

void UORCharacterMovementComponent::UpdateCharacterStateBeforeMovement(float DeltaSeconds)
{
	if (CharacterOwner)
	{
		const bool bWants = bWantsToSlide != 0;

		if (bWants && !bIsSliding && CanStartSlide())
		{
			// Crouch() is predicted and resizes the capsule for us.
			CharacterOwner->Crouch(true);
			StartSlide();
		}
		else if (bIsSliding)
		{
			const bool bTooSlow = Velocity.SizeSquared2D() < FMath::Square(SlideMinSpeed * 0.6f);
			const bool bLeftGround = !IsMovingOnGround();

			if (!bWants || bTooSlow || bLeftGround)
			{
				StopSlide();
				// UnCrouch refuses while a ceiling is overhead, which keeps us
				// sliding through a low tunnel instead of popping into it.
				CharacterOwner->UnCrouch(true);
			}
		}
	}

	Super::UpdateCharacterStateBeforeMovement(DeltaSeconds);
}

void UORCharacterMovementComponent::OnMovementUpdated(
	float DeltaSeconds, const FVector& OldLocation, const FVector& OldVelocity)
{
	Super::OnMovementUpdated(DeltaSeconds, OldLocation, OldVelocity);

	if (BoostRemaining > 0.f)
	{
		BoostRemaining = FMath::Max(0.f, BoostRemaining - BoostDecayPerSecond * DeltaSeconds);
	}
}

float UORCharacterMovementComponent::GetMaxSpeed() const
{
	const float Base = Super::GetMaxSpeed();

	if (MovementMode == MOVE_Walking || MovementMode == MOVE_NavWalking)
	{
		return Base + BoostRemaining;
	}

	return Base;
}

float UORCharacterMovementComponent::GetMaxBrakingDeceleration() const
{
	if (bIsSliding && IsMovingOnGround())
	{
		return SlideBrakingDeceleration;
	}
	return Super::GetMaxBrakingDeceleration();
}
