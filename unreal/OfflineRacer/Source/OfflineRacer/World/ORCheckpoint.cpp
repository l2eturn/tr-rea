#include "World/ORCheckpoint.h"

#include "Character/ORCharacter.h"
#include "Components/BoxComponent.h"
#include "Game/ORGameMode.h"

AORCheckpoint::AORCheckpoint()
{
	PrimaryActorTick.bCanEverTick = false;
	bReplicates = false; // Level geometry; the result replicates via PlayerState.

	Trigger = CreateDefaultSubobject<UBoxComponent>(TEXT("Trigger"));
	Trigger->SetBoxExtent(FVector(60.f, 400.f, 400.f));
	Trigger->SetCollisionProfileName(TEXT("Trigger"));
	Trigger->SetGenerateOverlapEvents(true);
	RootComponent = Trigger;

	RespawnPoint = CreateDefaultSubobject<USceneComponent>(TEXT("RespawnPoint"));
	RespawnPoint->SetupAttachment(RootComponent);
	RespawnPoint->SetRelativeLocation(FVector(0.f, 0.f, 120.f));
}

void AORCheckpoint::BeginPlay()
{
	Super::BeginPlay();
	Trigger->OnComponentBeginOverlap.AddDynamic(this, &AORCheckpoint::OnOverlap);
}

FTransform AORCheckpoint::GetRespawnTransform() const
{
	return RespawnPoint ? RespawnPoint->GetComponentTransform() : GetActorTransform();
}

void AORCheckpoint::OnOverlap(UPrimitiveComponent*, AActor* Other, UPrimitiveComponent*,
	int32, bool, const FHitResult&)
{
	// Only the authority may advance race progress.
	if (!HasAuthority())
	{
		return;
	}

	AORCharacter* Racer = Cast<AORCharacter>(Other);
	if (!Racer)
	{
		return;
	}

	AORGameMode* GM = GetWorld() ? GetWorld()->GetAuthGameMode<AORGameMode>() : nullptr;
	if (!GM)
	{
		return;
	}

	if (bIsFinishLine)
	{
		GM->TryRegisterFinish(Racer);
	}
	else
	{
		GM->TryRegisterCheckpoint(Racer, CheckpointIndex);
	}
}
