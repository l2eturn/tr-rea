// Persistent practice data: best time, sector splits, and the recorded ghost
// of the best run.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/SaveGame.h"
#include "ORSaveGame.generated.h"

USTRUCT(BlueprintType)
struct FORGhostFrame
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadWrite, Category = "Ghost")
	float Time = 0.f;

	UPROPERTY(BlueprintReadWrite, Category = "Ghost")
	FVector Location = FVector::ZeroVector;

	UPROPERTY(BlueprintReadWrite, Category = "Ghost")
	FRotator Rotation = FRotator::ZeroRotator;
};

UCLASS()
class OFFLINERACER_API UORSaveGame : public USaveGame
{
	GENERATED_BODY()

public:
	/** Negative when there is no recorded time yet. */
	UPROPERTY(BlueprintReadWrite, Category = "Race")
	float BestTime = -1.f;

	UPROPERTY(BlueprintReadWrite, Category = "Race")
	TArray<float> BestSplits;

	UPROPERTY(BlueprintReadWrite, Category = "Race")
	TArray<FORGhostFrame> GhostFrames;

	UPROPERTY(BlueprintReadWrite, Category = "Race")
	int32 Runs = 0;

	static const TCHAR* SlotName() { return TEXT("OfflineRacerPractice"); }
};
