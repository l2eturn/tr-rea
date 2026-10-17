// Records the local racer's path during a run and plays back the saved best
// run as a ghost. Recording samples at a fixed interval, so a ghost costs the
// same regardless of frame rate.

#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "Save/ORSaveGame.h"
#include "ORGhostRecorder.generated.h"

UCLASS(ClassGroup = (OfflineRacer), meta = (BlueprintSpawnableComponent))
class OFFLINERACER_API UORGhostRecorder : public UActorComponent
{
	GENERATED_BODY()

public:
	UORGhostRecorder();

	UPROPERTY(EditDefaultsOnly, Category = "Ghost")
	float SampleInterval = 1.f / 30.f;

	UFUNCTION(BlueprintCallable, Category = "Ghost")
	void BeginRecording();

	UFUNCTION(BlueprintCallable, Category = "Ghost")
	void StopRecording();

	/** Saves the run if it beats the stored best. Returns true when it did. */
	UFUNCTION(BlueprintCallable, Category = "Ghost")
	bool CommitRun(float FinishTime, const TArray<float>& Splits);

	/** Interpolated ghost transform at a race time, if a ghost exists. */
	UFUNCTION(BlueprintCallable, Category = "Ghost")
	bool SampleGhost(float RaceTime, FTransform& OutTransform) const;

	UFUNCTION(BlueprintPure, Category = "Ghost")
	bool HasGhost() const { return LoadedGhost.Num() > 1; }

	UFUNCTION(BlueprintPure, Category = "Ghost")
	float GetBestTime() const { return BestTime; }

	virtual void TickComponent(float DeltaTime, ELevelTick TickType,
		FActorComponentTickFunction* ThisTickFunction) override;

protected:
	virtual void BeginPlay() override;

private:
	TArray<FORGhostFrame> Recording;
	TArray<FORGhostFrame> LoadedGhost;
	TArray<float> BestSplits;

	float BestTime = -1.f;
	int32 Runs = 0;

	bool bRecording = false;
	float Elapsed = 0.f;
	float SinceLastSample = 0.f;
};
