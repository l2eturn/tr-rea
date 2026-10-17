#include "Game/ORPlayerController.h"

#include "Character/ORCharacter.h"
#include "Game/ORGameState.h"
#include "Kismet/GameplayStatics.h"

AORPlayerController::AORPlayerController()
{
	bShowMouseCursor = false;
}

void AORPlayerController::SetupInputComponent()
{
	Super::SetupInputComponent();

	if (!InputComponent)
	{
		return;
	}

	InputComponent->BindAxis("MoveRight", this, &AORPlayerController::OnMoveRight);

	InputComponent->BindAction("Jump", IE_Pressed, this, &AORPlayerController::OnJumpPressed);
	InputComponent->BindAction("Jump", IE_Released, this, &AORPlayerController::OnJumpReleased);
	InputComponent->BindAction("Slide", IE_Pressed, this, &AORPlayerController::OnSlidePressed);
	InputComponent->BindAction("Slide", IE_Released, this, &AORPlayerController::OnSlideReleased);
	InputComponent->BindAction("RestartRace", IE_Pressed, this, &AORPlayerController::OnRestartPressed);
}

AORCharacter* AORPlayerController::GetRacer() const
{
	return Cast<AORCharacter>(GetPawn());
}

void AORPlayerController::OnMoveRight(float Value)
{
	// The countdown is enforced here and again by the game mode, which refuses
	// any checkpoint claimed before the race is running.
	const AORGameState* GS = GetWorld() ? GetWorld()->GetGameState<AORGameState>() : nullptr;
	if (GS && GS->RacePhase != ERacePhase::Running)
	{
		return;
	}

	if (AORCharacter* Racer = GetRacer())
	{
		Racer->MoveRight(Value);
	}
}

void AORPlayerController::OnJumpPressed()
{
	const AORGameState* GS = GetWorld() ? GetWorld()->GetGameState<AORGameState>() : nullptr;
	if (GS && GS->RacePhase != ERacePhase::Running)
	{
		return;
	}

	if (AORCharacter* Racer = GetRacer())
	{
		if (!Racer->IsStunned())
		{
			Racer->Jump();
		}
	}
}

void AORPlayerController::OnJumpReleased()
{
	if (AORCharacter* Racer = GetRacer())
	{
		Racer->StopJumping();
	}
}

void AORPlayerController::OnSlidePressed()
{
	if (AORCharacter* Racer = GetRacer())
	{
		Racer->StartSliding();
	}
}

void AORPlayerController::OnSlideReleased()
{
	if (AORCharacter* Racer = GetRacer())
	{
		Racer->StopSliding();
	}
}

void AORPlayerController::OnRestartPressed()
{
	// Standalone practice convenience: reload the level for a fresh race.
	if (UWorld* World = GetWorld())
	{
		UGameplayStatics::OpenLevel(World, FName(*World->GetName()), false);
	}
}
