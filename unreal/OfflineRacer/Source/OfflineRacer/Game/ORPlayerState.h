// Per-racer race progress. Server writes, everyone reads.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/PlayerState.h"
#include "ORPlayerState.generated.h"

UCLASS()
class OFFLINERACER_API AORPlayerState : public APlayerState
{
	GENERATED_BODY()

public:
	/** How many checkpoints have been passed. */
	UPROPERTY(Replicated, BlueprintReadOnly, Category = "Race")
	int32 SectorIndex = 0;

	/** Race time at each checkpoint, in seconds. */
	UPROPERTY(Replicated, BlueprintReadOnly, Category = "Race")
	TArray<float> Splits;

	/** Negative until the racer crosses the finish line. */
	UPROPERTY(Replicated, BlueprintReadOnly, Category = "Race")
	float FinishTime = -1.f;

	UPROPERTY(Replicated, BlueprintReadOnly, Category = "Race")
	int32 Respawns = 0;

	UPROPERTY(Replicated, BlueprintReadOnly, Category = "Race")
	bool bIsBot = false;

	/** Furthest distance reached along the track, used for live ranking. */
	UPROPERTY(Replicated, BlueprintReadOnly, Category = "Race")
	float Progress = 0.f;

	UFUNCTION(BlueprintPure, Category = "Race")
	bool HasFinished() const { return FinishTime >= 0.f; }

	void ResetRaceProgress();

	virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;
};
