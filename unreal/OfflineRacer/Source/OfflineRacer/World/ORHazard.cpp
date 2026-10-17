#include "World/ORHazard.h"

#include "Character/ORCharacter.h"
#include "Components/BoxComponent.h"

AORHazard::AORHazard()
{
	PrimaryActorTick.bCanEverTick = false;

	Trigger = CreateDefaultSubobject<UBoxComponent>(TEXT("Trigger"));
	Trigger->SetBoxExtent(FVector(50.f, 100.f, 30.f));
	Trigger->SetCollisionProfileName(TEXT("Trigger"));
	Trigger->SetGenerateOverlapEvents(true);
	RootComponent = Trigger;
}

void AORHazard::BeginPlay()
{
	Super::BeginPlay();
	Trigger->OnComponentBeginOverlap.AddDynamic(this, &AORHazard::OnOverlap);
}

void AORHazard::OnOverlap(UPrimitiveComponent*, AActor* Other, UPrimitiveComponent*,
	int32, bool, const FHitResult&)
{
	if (!HasAuthority())
	{
		return;
	}

	AORCharacter* Racer = Cast<AORCharacter>(Other);
	if (!Racer || Racer->IsInvulnerable())
	{
		return;
	}

	// Knock the racer back out of the hazard so they are not sitting in it.
	const FVector Knockback = FVector(-KnockbackStrength, 0.f, KnockbackStrength * 0.5f);
	Racer->ApplyStun(StunDuration, Knockback);
}
