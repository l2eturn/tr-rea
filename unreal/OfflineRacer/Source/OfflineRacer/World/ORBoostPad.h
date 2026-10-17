// Boost pad and pickup. Both just grant boost to the movement component, which
// predicts it, so the effect feels instant on the client.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "ORBoostPad.generated.h"

class UBoxComponent;

UCLASS()
class OFFLINERACER_API AORBoostPad : public AActor
{
	GENERATED_BODY()

public:
	AORBoostPad();

	UPROPERTY(EditAnywhere, Category = "Boost")
	float BoostAmount = 420.f;

	/** Pickups disappear when taken; pads stay. */
	UPROPERTY(EditAnywhere, Category = "Boost")
	bool bConsumeOnTouch = false;

	/** Seconds before a consumed pickup returns. 0 keeps it gone. */
	UPROPERTY(EditAnywhere, Category = "Boost")
	float RespawnDelay = 5.f;

protected:
	UPROPERTY(VisibleAnywhere, Category = "Boost")
	UBoxComponent* Trigger;

	UFUNCTION()
	void OnOverlap(UPrimitiveComponent* OverlappedComp, AActor* Other,
		UPrimitiveComponent* OtherComp, int32 OtherBodyIndex,
		bool bFromSweep, const FHitResult& Sweep);

	UFUNCTION()
	void Reappear();

	virtual void BeginPlay() override;
};
