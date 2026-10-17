// Race session. The authority for the whole race: it runs the countdown,
// spawns the bots, validates checkpoint and finish claims, and decides the
// result. It behaves identically in standalone, listen server and dedicated
// server, which is why the offline practice mode is still authoritative.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "ORGameMode.generated.h"

class AORCharacter;
class AORPlayerState;
class AORCheckpoint;

UCLASS()
class OFFLINERACER_API AORGameMode : public AGameModeBase
{
	GENERATED_BODY()

public:
	AORGameMode();

	/** Seconds of countdown before inputs are allowed to matter. */
	UPROPERTY(EditDefaultsOnly, Category = "Race")
	float CountdownSeconds = 3.f;

	UPROPERTY(EditDefaultsOnly, Category = "Race")
	int32 BotCount = 3;

	UPROPERTY(EditDefaultsOnly, Category = "Race")
	TSubclassOf<AORCharacter> BotCharacterClass;

	/** Largest believable distance gain in one validation window. Anything
	 *  beyond it is refused rather than written into the race state. */
	UPROPERTY(EditDefaultsOnly, Category = "Race|Validation")
	float MaxProgressPerSecond = 3000.f;

	/** Checkpoints must be crossed in order; a skipped one is refused. */
	UFUNCTION(BlueprintCallable, Category = "Race")
	bool TryRegisterCheckpoint(AORCharacter* Racer, int32 CheckpointIndex);

	UFUNCTION(BlueprintCallable, Category = "Race")
	bool TryRegisterFinish(AORCharacter* Racer);

	UFUNCTION(BlueprintPure, Category = "Race|Validation")
	int32 GetRejectionCount() const { return RejectionCount; }

	virtual void Tick(float DeltaSeconds) override;
	virtual void StartPlay() override;

protected:
	/** Refuses a claim and records why. Visible to the HUD. */
	void RejectClaim(const AORPlayerState* Racer, const FString& Reason);

	void SpawnBots();
	void BeginCountdown();
	void BeginRace();
	void UpdateProgress(float DeltaSeconds);

private:
	UPROPERTY()
	TArray<AORCheckpoint*> Checkpoints;

	int32 RejectionCount = 0;
	float CountdownRemaining = 0.f;
};
