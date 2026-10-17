// The racer. Used for both the human and the bots, so every rule they obey is
// the same rule — a bot is just another source of input.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "ORCharacter.generated.h"

class UORCharacterMovementComponent;
class UCameraComponent;
class USpringArmComponent;

UCLASS()
class OFFLINERACER_API AORCharacter : public ACharacter
{
	GENERATED_BODY()

public:
	AORCharacter(const FObjectInitializer& ObjectInitializer);

	UFUNCTION(BlueprintPure, Category = "Offline Racer")
	UORCharacterMovementComponent* GetORMovement() const { return ORMovement; }

	/** Input entry points. Also called by the bot controller. */
	void MoveRight(float Value);
	void StartSliding();
	void StopSliding();

	/** Applied by hazards. Server authoritative, replicated to everyone. */
	UFUNCTION(BlueprintCallable, Category = "Offline Racer")
	void ApplyStun(float Duration, const FVector& Knockback);

	UFUNCTION(BlueprintPure, Category = "Offline Racer")
	bool IsStunned() const { return StunRemaining > 0.f; }

	/** Brief window after a hazard where it cannot hit you again, so standing
	 *  in a hazard cannot trap you in a permanent stun. */
	UFUNCTION(BlueprintPure, Category = "Offline Racer")
	bool IsInvulnerable() const { return InvulnerableRemaining > 0.f; }

	virtual void Tick(float DeltaSeconds) override;
	virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;

protected:
	UPROPERTY(VisibleAnywhere, Category = "Offline Racer")
	USpringArmComponent* CameraBoom;

	UPROPERTY(VisibleAnywhere, Category = "Offline Racer")
	UCameraComponent* SideViewCamera;

	UPROPERTY(EditDefaultsOnly, Category = "Offline Racer|Hazard")
	float HazardInvulnerability = 1.5f;

private:
	UPROPERTY()
	UORCharacterMovementComponent* ORMovement;

	UPROPERTY(ReplicatedUsing = OnRep_Stun)
	float StunRemaining = 0.f;

	float InvulnerableRemaining = 0.f;

	UFUNCTION()
	void OnRep_Stun();
};
