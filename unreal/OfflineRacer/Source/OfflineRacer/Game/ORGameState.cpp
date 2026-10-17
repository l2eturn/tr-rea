#include "Game/ORGameState.h"

#include "Game/ORPlayerState.h"
#include "Net/UnrealNetwork.h"

float AORGameState::GetRaceElapsed() const
{
	if (RaceStartTime < 0.f)
	{
		return 0.f;
	}
	return FMath::Max(0.f, GetServerWorldTimeSeconds() - RaceStartTime);
}

TArray<AORPlayerState*> AORGameState::GetStandings() const
{
	TArray<AORPlayerState*> Racers;
	for (APlayerState* Raw : PlayerArray)
	{
		if (AORPlayerState* Racer = Cast<AORPlayerState>(Raw))
		{
			Racers.Add(Racer);
		}
	}

	Racers.Sort([](const AORPlayerState& A, const AORPlayerState& B)
	{
		const bool bAFinished = A.FinishTime >= 0.f;
		const bool bBFinished = B.FinishTime >= 0.f;

		if (bAFinished && bBFinished)
		{
			return A.FinishTime < B.FinishTime;
		}
		if (bAFinished != bBFinished)
		{
			return bAFinished;
		}
		return A.Progress > B.Progress;
	});

	return Racers;
}

int32 AORGameState::GetRankOf(AORPlayerState* Racer) const
{
	if (!Racer)
	{
		return 0;
	}

	const TArray<AORPlayerState*> Standings = GetStandings();
	const int32 Index = Standings.IndexOfByKey(Racer);
	return Index == INDEX_NONE ? Standings.Num() : Index + 1;
}

void AORGameState::OnRep_RacePhase()
{
	// Hook for HUD transitions.
}

void AORGameState::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
	Super::GetLifetimeReplicatedProps(OutLifetimeProps);

	DOREPLIFETIME(AORGameState, RacePhase);
	DOREPLIFETIME(AORGameState, RaceStartTime);
	DOREPLIFETIME(AORGameState, CountdownRemaining);
	DOREPLIFETIME(AORGameState, CheckpointCount);
}
