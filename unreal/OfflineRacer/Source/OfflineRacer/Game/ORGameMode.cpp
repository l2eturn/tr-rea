#include "Game/ORGameMode.h"

#include "Character/ORCharacter.h"
#include "EngineUtils.h"
#include "Game/ORGameState.h"
#include "Game/ORPlayerController.h"
#include "Game/ORPlayerState.h"
#include "World/ORCheckpoint.h"
#include "AI/ORBotController.h"
#include "GameFramework/PlayerStart.h"

AORGameMode::AORGameMode()
{
	PrimaryActorTick.bCanEverTick = true;

	GameStateClass = AORGameState::StaticClass();
	PlayerStateClass = AORPlayerState::StaticClass();
	PlayerControllerClass = AORPlayerController::StaticClass();
	DefaultPawnClass = AORCharacter::StaticClass();
	BotCharacterClass = AORCharacter::StaticClass();

	bStartPlayersAsSpectators = false;
}

void AORGameMode::StartPlay()
{
	Super::StartPlay();

	// Collect the checkpoints the level author placed, ordered by index.
	Checkpoints.Reset();
	for (TActorIterator<AORCheckpoint> It(GetWorld()); It; ++It)
	{
		Checkpoints.Add(*It);
	}
	Checkpoints.Sort([](const AORCheckpoint& A, const AORCheckpoint& B)
	{
		return A.CheckpointIndex < B.CheckpointIndex;
	});

	if (AORGameState* GS = GetGameState<AORGameState>())
	{
		GS->CheckpointCount = Checkpoints.Num();
	}

	SpawnBots();
	BeginCountdown();
}

void AORGameMode::SpawnBots()
{
	if (BotCount <= 0 || !BotCharacterClass)
	{
		return;
	}

	// Spread the bots across any spare player starts, falling back to an
	// offset from the first one.
	TArray<AActor*> Starts;
	for (TActorIterator<APlayerStart> It(GetWorld()); It; ++It)
	{
		Starts.Add(*It);
	}

	const FVector Base = Starts.Num() > 0 ? Starts[0]->GetActorLocation() : FVector::ZeroVector;

	for (int32 i = 0; i < BotCount; ++i)
	{
		FVector Location = Base + FVector(0.f, 0.f, 0.f) + FVector(-120.f * (i + 1), 0.f, 0.f);
		if (Starts.IsValidIndex(i + 1))
		{
			Location = Starts[i + 1]->GetActorLocation();
		}

		FActorSpawnParameters Params;
		Params.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AdjustIfPossibleButAlwaysSpawn;

		AORCharacter* Bot = GetWorld()->SpawnActor<AORCharacter>(
			BotCharacterClass, Location, FRotator::ZeroRotator, Params);
		if (!Bot)
		{
			continue;
		}

		AORBotController* Controller = GetWorld()->SpawnActor<AORBotController>(
			AORBotController::StaticClass(), Location, FRotator::ZeroRotator);
		if (Controller)
		{
			// Later bots are slightly less sharp, so the field spreads out.
			Controller->Skill = FMath::Clamp(0.95f - 0.12f * i, 0.5f, 1.f);
			Controller->Possess(Bot);

			if (AORPlayerState* BotState = Bot->GetPlayerState<AORPlayerState>())
			{
				BotState->bIsBot = true;
				BotState->SetPlayerName(FString::Printf(TEXT("Bot %d"), i + 1));
			}
		}
	}
}

void AORGameMode::BeginCountdown()
{
	CountdownRemaining = CountdownSeconds;

	if (AORGameState* GS = GetGameState<AORGameState>())
	{
		GS->RacePhase = ERacePhase::Countdown;
		GS->CountdownRemaining = CountdownRemaining;
		GS->RaceStartTime = -1.f;
	}
}

void AORGameMode::BeginRace()
{
	if (AORGameState* GS = GetGameState<AORGameState>())
	{
		GS->RacePhase = ERacePhase::Running;
		GS->RaceStartTime = GetWorld()->GetTimeSeconds();
		GS->CountdownRemaining = 0.f;
	}
}

void AORGameMode::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);

	AORGameState* GS = GetGameState<AORGameState>();
	if (!GS)
	{
		return;
	}

	if (GS->RacePhase == ERacePhase::Countdown)
	{
		CountdownRemaining = FMath::Max(0.f, CountdownRemaining - DeltaSeconds);
		GS->CountdownRemaining = CountdownRemaining;

		if (CountdownRemaining <= 0.f)
		{
			BeginRace();
		}
		return;
	}

	if (GS->RacePhase == ERacePhase::Running)
	{
		UpdateProgress(DeltaSeconds);

		bool bEveryoneDone = GS->PlayerArray.Num() > 0;
		for (APlayerState* Raw : GS->PlayerArray)
		{
			const AORPlayerState* Racer = Cast<AORPlayerState>(Raw);
			if (Racer && !Racer->HasFinished())
			{
				bEveryoneDone = false;
				break;
			}
		}

		if (bEveryoneDone)
		{
			GS->RacePhase = ERacePhase::Finished;
		}
	}
}

void AORGameMode::UpdateProgress(float DeltaSeconds)
{
	const float MaxGain = MaxProgressPerSecond * DeltaSeconds;

	for (TActorIterator<AORCharacter> It(GetWorld()); It; ++It)
	{
		AORCharacter* Racer = *It;
		AORPlayerState* Racer_PS = Racer->GetPlayerState<AORPlayerState>();
		if (!Racer_PS || Racer_PS->HasFinished())
		{
			continue;
		}

		// Side-scroller: progress along the track is world X.
		const float Candidate = Racer->GetActorLocation().X;
		const float Gain = Candidate - Racer_PS->Progress;

		if (Gain > MaxGain)
		{
			// Faster than the simulation can possibly allow. Clamp instead of
			// accepting it, and record that it happened.
			Racer_PS->Progress += MaxGain;
			RejectClaim(Racer_PS, TEXT("progress-rate-exceeded"));
		}
		else if (Gain > 0.f)
		{
			Racer_PS->Progress = Candidate;
		}
	}
}

bool AORGameMode::TryRegisterCheckpoint(AORCharacter* Racer, int32 CheckpointIndex)
{
	if (!Racer)
	{
		return false;
	}

	AORPlayerState* Racer_PS = Racer->GetPlayerState<AORPlayerState>();
	AORGameState* GS = GetGameState<AORGameState>();
	if (!Racer_PS || !GS)
	{
		return false;
	}

	if (GS->RacePhase != ERacePhase::Running)
	{
		RejectClaim(Racer_PS, TEXT("checkpoint-before-race-start"));
		return false;
	}

	// Checkpoints must be taken in order: this is what stops a racer from
	// skipping half the track.
	if (CheckpointIndex != Racer_PS->SectorIndex)
	{
		RejectClaim(Racer_PS, FString::Printf(
			TEXT("checkpoint-out-of-order (expected %d, got %d)"),
			Racer_PS->SectorIndex, CheckpointIndex));
		return false;
	}

	Racer_PS->SectorIndex = CheckpointIndex + 1;
	Racer_PS->Splits.Add(GS->GetRaceElapsed());
	return true;
}

bool AORGameMode::TryRegisterFinish(AORCharacter* Racer)
{
	if (!Racer)
	{
		return false;
	}

	AORPlayerState* Racer_PS = Racer->GetPlayerState<AORPlayerState>();
	AORGameState* GS = GetGameState<AORGameState>();
	if (!Racer_PS || !GS)
	{
		return false;
	}

	if (Racer_PS->HasFinished())
	{
		return false;
	}

	if (GS->RacePhase != ERacePhase::Running)
	{
		RejectClaim(Racer_PS, TEXT("finish-outside-running-phase"));
		return false;
	}

	// Every checkpoint has to be accounted for before a finish counts.
	if (Racer_PS->SectorIndex < GS->CheckpointCount)
	{
		RejectClaim(Racer_PS, FString::Printf(
			TEXT("finish-with-missing-checkpoints (%d of %d)"),
			Racer_PS->SectorIndex, GS->CheckpointCount));
		return false;
	}

	Racer_PS->FinishTime = GS->GetRaceElapsed();
	return true;
}

void AORGameMode::RejectClaim(const AORPlayerState* Racer, const FString& Reason)
{
	++RejectionCount;
	UE_LOG(LogTemp, Warning, TEXT("[Validation] refused %s for %s"),
		*Reason,
		Racer ? *Racer->GetPlayerName() : TEXT("<unknown>"));
}
