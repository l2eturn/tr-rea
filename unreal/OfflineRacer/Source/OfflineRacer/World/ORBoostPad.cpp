#include "World/ORBoostPad.h"

#include "Character/ORCharacter.h"
#include "Character/ORCharacterMovementComponent.h"
#include "Components/BoxComponent.h"
#include "TimerManager.h"

AORBoostPad::AORBoostPad()
{
	PrimaryActorTick.bCanEverTick = false;
	bReplicates = true;

	Trigger = CreateDefaultSubobject<UBoxComponent>(TEXT("Trigger"));
	Trigger->SetBoxExtent(FVector(60.f, 100.f, 40.f));
	Trigger->SetCollisionProfileName(TEXT("Trigger"));
	Trigger->SetGenerateOverlapEvents(true);
	RootComponent = Trigger;
}

void AORBoostPad::BeginPlay()
{
	Super::BeginPlay();
	Trigger->OnComponentBeginOverlap.AddDynamic(this, &AORBoostPad::OnOverlap);
}

void AORBoostPad::OnOverlap(UPrimitiveComponent*, AActor* Other, UPrimitiveComponent*,
	int32, bool, const FHitResult&)
{
	AORCharacter* Racer = Cast<AORCharacter>(Other);
	if (!Racer)
	{
		return;
	}

	// Grant on both sides: the owning client predicts it, the server confirms.
	if (UORCharacterMovementComponent* Move = Racer->GetORMovement())
	{
		Move->AddBoost(BoostAmount);
	}

	if (bConsumeOnTouch && HasAuthority())
	{
		SetActorHiddenInGame(true);
		SetActorEnableCollision(false);

		if (RespawnDelay > 0.f)
		{
			FTimerHandle Handle;
			GetWorldTimerManager().SetTimer(Handle, this, &AORBoostPad::Reappear, RespawnDelay, false);
		}
	}
}

void AORBoostPad::Reappear()
{
	SetActorHiddenInGame(false);
	SetActorEnableCollision(true);
}
