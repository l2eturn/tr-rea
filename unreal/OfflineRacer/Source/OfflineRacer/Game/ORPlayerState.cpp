#include "Game/ORPlayerState.h"

#include "Net/UnrealNetwork.h"

void AORPlayerState::ResetRaceProgress()
{
	SectorIndex = 0;
	Splits.Reset();
	FinishTime = -1.f;
	Respawns = 0;
	Progress = 0.f;
}

void AORPlayerState::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
	Super::GetLifetimeReplicatedProps(OutLifetimeProps);

	DOREPLIFETIME(AORPlayerState, SectorIndex);
	DOREPLIFETIME(AORPlayerState, Splits);
	DOREPLIFETIME(AORPlayerState, FinishTime);
	DOREPLIFETIME(AORPlayerState, Respawns);
	DOREPLIFETIME(AORPlayerState, bIsBot);
	DOREPLIFETIME(AORPlayerState, Progress);
}
