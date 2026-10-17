// Checkpoint / finish line volume. It reports the crossing to the game mode
// and nothing more: the game mode decides whether the claim is legitimate.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "ORCheckpoint.generated.h"

class UBoxComponent;

UCLASS()
class OFFLINERACER_API AORCheckpoint : public AActor
{
	GENERATED_BODY()

public:
	AORCheckpoint();

	/** 0-based order along the track. Must be unique and contiguous. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Checkpoint")
	int32 CheckpointIndex = 0;

	/** Tick this on the last volume to make it the finish line. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Checkpoint")
	bool bIsFinishLine = false;

	/** Respawn transform for racers who fall after reaching this checkpoint. */
	UFUNCTION(BlueprintPure, Category = "Checkpoint")
	FTransform GetRespawnTransform() const;

protected:
	UPROPERTY(VisibleAnywhere, Category = "Checkpoint")
	UBoxComponent* Trigger;

	UPROPERTY(VisibleAnywhere, Category = "Checkpoint")
	USceneComponent* RespawnPoint;

	UFUNCTION()
	void OnOverlap(UPrimitiveComponent* OverlappedComp, AActor* Other,
		UPrimitiveComponent* OtherComp, int32 OtherBodyIndex,
		bool bFromSweep, const FHitResult& Sweep);

	virtual void BeginPlay() override;
};
