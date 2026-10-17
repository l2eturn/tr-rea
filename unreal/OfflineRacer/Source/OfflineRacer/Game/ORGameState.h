// Authoritative race state: the phase, when the race started, and the order
// racers finished in. This is the only copy that decides the result.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameStateBase.h"
#include "ORGameState.generated.h"

UENUM(BlueprintType)
enum class ERacePhase : uint8
{
	WaitingToStart,
	Countdown,
	Running,
	Finished
};

UCLASS()
class OFFLINERACER_API AORGameState : public AGameStateBase
{
	GENERATED_BODY()

public:
	UPROPERTY(ReplicatedUsing = OnRep_RacePhase, BlueprintReadOnly, Category = "Race")
	ERacePhase RacePhase = ERacePhase::WaitingToStart;

	/** Server world time the race started. Negative before the start. */
	UPROPERTY(Replicated, BlueprintReadOnly, Category = "Race")
	float RaceStartTime = -1.f;

	/** Seconds remaining on the countdown, for the HUD. */
	UPROPERTY(Replicated, BlueprintReadOnly, Category = "Race")
	float CountdownRemaining = 0.f;

	/** Total checkpoints on this track. */
	UPROPERTY(Replicated, BlueprintReadOnly, Category = "Race")
	int32 CheckpointCount = 0;

	/** Elapsed race time, safe to call on client or server. */
	UFUNCTION(BlueprintPure, Category = "Race")
	float GetRaceElapsed() const;

	/** 1-based live position of a racer. */
	UFUNCTION(BlueprintPure, Category = "Race")
	int32 GetRankOf(class AORPlayerState* Racer) const;

	/** Racers sorted by finish time, then by distance covered. */
	UFUNCTION(BlueprintPure, Category = "Race")
	TArray<AORPlayerState*> GetStandings() const;

	virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;

protected:
	UFUNCTION()
	void OnRep_RacePhase();
};
