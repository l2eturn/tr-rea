// Bot racer. It produces ordinary movement input and goes through the exact
// same character and movement component as the human, so a bot is never
// privileged: it just holds different buttons.
//
// Decisions come from short line traces ahead of the racer, mirroring the
// JavaScript prototype's lookahead logic.

#pragma once

#include "CoreMinimal.h"
#include "AIController.h"
#include "ORBotController.generated.h"

class AORCharacter;

UCLASS()
class OFFLINERACER_API AORBotController : public AAIController
{
	GENERATED_BODY()

public:
	AORBotController();

	/** 0..1. Lower skill misses some jumps and eases off the throttle. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Bot")
	float Skill = 0.9f;

	/** How far ahead to look for gaps and hazards, before speed scaling. */
	UPROPERTY(EditDefaultsOnly, Category = "Bot")
	float BaseLookAhead = 180.f;

	virtual void Tick(float DeltaSeconds) override;

protected:
	/** Is there walkable floor this far ahead? */
	bool HasFloorAhead(const AORCharacter* Racer, float Distance) const;

	/** Is something solid blocking the body at running height? */
	bool IsBlockedAhead(const AORCharacter* Racer, float Distance) const;

	/** Is there a low ceiling that needs sliding under? */
	bool IsCeilingAhead(const AORCharacter* Racer, float Distance) const;

private:
	float JumpCooldown = 0.f;
};
