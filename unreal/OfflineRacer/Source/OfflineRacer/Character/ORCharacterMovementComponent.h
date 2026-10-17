// Custom character movement: a predicted slide and a predicted speed boost.
//
// Design note: the slide is built on top of the engine's crouch system rather
// than a MOVE_Custom mode. Crouch is already network-predicted, already
// resizes the capsule, and already refuses to stand you up when there is a
// ceiling overhead. In the JavaScript prototype all three of those had to be
// written and debugged by hand (the "stand up inside a slide tunnel" bug cost
// a 205 uu teleport); here the engine owns them.
//
// What still needs predicting by hand is our own state: whether the player
// wants to slide, and how much boost is left. Both live in FSavedMove_OR so
// the client and the server agree without correction.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "ORCharacterMovementComponent.generated.h"

UCLASS()
class OFFLINERACER_API UORCharacterMovementComponent : public UCharacterMovementComponent
{
	GENERATED_BODY()

	/** Saved move that carries our predicted state across a correction. */
	class FSavedMove_OR : public FSavedMove_Character
	{
	public:
		typedef FSavedMove_Character Super;

		uint8 bSavedWantsToSlide : 1;
		float SavedBoostRemaining;

		FSavedMove_OR();

		virtual void Clear() override;
		virtual uint8 GetCompressedFlags() const override;
		virtual bool CanCombineWith(const FSavedMovePtr& NewMove, ACharacter* InCharacter, float MaxDelta) const override;
		virtual void SetMoveFor(ACharacter* C, float InDeltaTime, FVector const& NewAccel, FNetworkPredictionData_Client_Character& ClientData) override;
		virtual void PrepMoveFor(ACharacter* C) override;
	};

	class FNetworkPredictionData_Client_OR : public FNetworkPredictionData_Client_Character
	{
	public:
		typedef FNetworkPredictionData_Client_Character Super;

		explicit FNetworkPredictionData_Client_OR(const UCharacterMovementComponent& ClientMovement);

		virtual FSavedMovePtr AllocateNewMove() override;
	};

public:
	UORCharacterMovementComponent();

	// ---- Slide tuning (mirrors src/shared/constants.js) ----------------

	/** Speed added the moment a slide starts. */
	UPROPERTY(EditDefaultsOnly, Category = "Offline Racer|Slide")
	float SlideEnterImpulse = 450.f;

	/** Top speed while sliding. Higher than running, which is the point. */
	UPROPERTY(EditDefaultsOnly, Category = "Offline Racer|Slide")
	float SlideMaxSpeed = 1450.f;

	/** Ground friction while sliding. Low, so you keep the speed you earned. */
	UPROPERTY(EditDefaultsOnly, Category = "Offline Racer|Slide")
	float SlideGroundFriction = 0.45f;

	UPROPERTY(EditDefaultsOnly, Category = "Offline Racer|Slide")
	float SlideBrakingDeceleration = 500.f;

	/** Below this speed the slide ends by itself. */
	UPROPERTY(EditDefaultsOnly, Category = "Offline Racer|Slide")
	float SlideMinSpeed = 320.f;

	// ---- Boost tuning --------------------------------------------------

	UPROPERTY(EditDefaultsOnly, Category = "Offline Racer|Boost")
	float MaxBoost = 600.f;

	UPROPERTY(EditDefaultsOnly, Category = "Offline Racer|Boost")
	float BoostDecayPerSecond = 260.f;

	// ---- API -----------------------------------------------------------

	/** Called from input. Safe on both the owning client and the server. */
	void SetWantsToSlide(bool bWants);

	UFUNCTION(BlueprintPure, Category = "Offline Racer")
	bool IsSliding() const;

	/** Grant boost. Predicted, so pickups feel instant on the client. */
	void AddBoost(float Amount);

	UFUNCTION(BlueprintPure, Category = "Offline Racer")
	float GetBoostRemaining() const { return BoostRemaining; }

	UFUNCTION(BlueprintPure, Category = "Offline Racer")
	float GetBoostAlpha() const { return MaxBoost > 0.f ? BoostRemaining / MaxBoost : 0.f; }

	// ---- UCharacterMovementComponent -----------------------------------

	virtual float GetMaxSpeed() const override;
	virtual float GetMaxBrakingDeceleration() const override;
	virtual FNetworkPredictionData_Client* GetPredictionData_Client() const override;

protected:
	virtual void InitializeComponent() override;
	virtual void UpdateFromCompressedFlags(uint8 Flags) override;
	virtual void UpdateCharacterStateBeforeMovement(float DeltaSeconds) override;
	virtual void OnMovementUpdated(float DeltaSeconds, const FVector& OldLocation, const FVector& OldVelocity) override;

private:
	/** Set from input, replicated to the server through a compressed flag. */
	uint8 bWantsToSlide : 1;

	/** True while the slide is actually running. */
	uint8 bIsSliding : 1;

	float BoostRemaining = 0.f;

	/** Friction to restore when the slide ends. */
	float CachedGroundFriction = 8.f;
	float CachedBrakingDeceleration = 2048.f;

	bool CanStartSlide() const;
	void StartSlide();
	void StopSlide();
};
