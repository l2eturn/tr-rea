#include "Save/ORGhostRecorder.h"

#include "Kismet/GameplayStatics.h"

UORGhostRecorder::UORGhostRecorder()
{
	PrimaryComponentTick.bCanEverTick = true;
	PrimaryComponentTick.bStartWithTickEnabled = true;
}

void UORGhostRecorder::BeginPlay()
{
	Super::BeginPlay();

	// Load the stored best run, tolerating a missing or unreadable slot.
	if (UORSaveGame* Loaded = Cast<UORSaveGame>(
		UGameplayStatics::LoadGameFromSlot(UORSaveGame::SlotName(), 0)))
	{
		BestTime = Loaded->BestTime;
		BestSplits = Loaded->BestSplits;
		LoadedGhost = Loaded->GhostFrames;
		Runs = Loaded->Runs;
	}
}

void UORGhostRecorder::BeginRecording()
{
	Recording.Reset();
	Elapsed = 0.f;
	SinceLastSample = 0.f;
	bRecording = true;
}

void UORGhostRecorder::StopRecording()
{
	bRecording = false;
}

void UORGhostRecorder::TickComponent(float DeltaTime, ELevelTick TickType,
	FActorComponentTickFunction* ThisTickFunction)
{
	Super::TickComponent(DeltaTime, TickType, ThisTickFunction);

	if (!bRecording || !GetOwner())
	{
		return;
	}

	Elapsed += DeltaTime;
	SinceLastSample += DeltaTime;

	if (SinceLastSample < SampleInterval)
	{
		return;
	}
	SinceLastSample = 0.f;

	FORGhostFrame Frame;
	Frame.Time = Elapsed;
	Frame.Location = GetOwner()->GetActorLocation();
	Frame.Rotation = GetOwner()->GetActorRotation();
	Recording.Add(Frame);
}

bool UORGhostRecorder::CommitRun(float FinishTime, const TArray<float>& Splits)
{
	StopRecording();

	const bool bIsBest = BestTime < 0.f || FinishTime < BestTime;

	UORSaveGame* Save = Cast<UORSaveGame>(
		UGameplayStatics::LoadGameFromSlot(UORSaveGame::SlotName(), 0));
	if (!Save)
	{
		Save = Cast<UORSaveGame>(
			UGameplayStatics::CreateSaveGameObject(UORSaveGame::StaticClass()));
	}
	if (!Save)
	{
		return false;
	}

	Save->Runs = ++Runs;

	if (bIsBest)
	{
		BestTime = FinishTime;
		BestSplits = Splits;
		LoadedGhost = Recording;

		Save->BestTime = FinishTime;
		Save->BestSplits = Splits;
		Save->GhostFrames = Recording;
	}

	UGameplayStatics::SaveGameToSlot(Save, UORSaveGame::SlotName(), 0);
	return bIsBest;
}

bool UORGhostRecorder::SampleGhost(float RaceTime, FTransform& OutTransform) const
{
	if (LoadedGhost.Num() == 0)
	{
		return false;
	}

	if (RaceTime <= LoadedGhost[0].Time)
	{
		OutTransform = FTransform(LoadedGhost[0].Rotation, LoadedGhost[0].Location);
		return true;
	}

	const FORGhostFrame& Last = LoadedGhost.Last();
	if (RaceTime >= Last.Time)
	{
		OutTransform = FTransform(Last.Rotation, Last.Location);
		return true;
	}

	// Frames are in order, so a binary search finds the bracketing pair.
	int32 Low = 0;
	int32 High = LoadedGhost.Num() - 1;
	while (High - Low > 1)
	{
		const int32 Mid = (Low + High) / 2;
		if (LoadedGhost[Mid].Time <= RaceTime)
		{
			Low = Mid;
		}
		else
		{
			High = Mid;
		}
	}

	const FORGhostFrame& A = LoadedGhost[Low];
	const FORGhostFrame& B = LoadedGhost[High];
	const float Span = B.Time - A.Time;
	const float Alpha = Span > KINDA_SMALL_NUMBER ? (RaceTime - A.Time) / Span : 0.f;

	OutTransform = FTransform(
		FMath::Lerp(A.Rotation, B.Rotation, Alpha),
		FMath::Lerp(A.Location, B.Location, Alpha));
	return true;
}
