// Hazard volume: stuns and knocks back whoever touches it. The character grants
// itself brief invulnerability afterwards, so standing in a hazard cannot trap
// a racer in a permanent stun (a bug the prototype's tests caught).

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "ORHazard.generated.h"

class UBoxComponent;

UCLASS()
class OFFLINERACER_API AORHazard : public AActor
{
	GENERATED_BODY()

public:
	AORHazard();

	UPROPERTY(EditAnywhere, Category = "Hazard")
	float StunDuration = 0.6f;

	UPROPERTY(EditAnywhere, Category = "Hazard")
	float KnockbackStrength = 420.f;

protected:
	UPROPERTY(VisibleAnywhere, Category = "Hazard")
	UBoxComponent* Trigger;

	UFUNCTION()
	void OnOverlap(UPrimitiveComponent* OverlappedComp, AActor* Other,
		UPrimitiveComponent* OtherComp, int32 OtherBodyIndex,
		bool bFromSweep, const FHitResult& Sweep);

	virtual void BeginPlay() override;
};
