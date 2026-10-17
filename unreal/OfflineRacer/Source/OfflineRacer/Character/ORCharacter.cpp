#include "Character/ORCharacter.h"

#include "Camera/CameraComponent.h"
#include "Character/ORCharacterMovementComponent.h"
#include "Components/CapsuleComponent.h"
#include "GameFramework/SpringArmComponent.h"
#include "Net/UnrealNetwork.h"

AORCharacter::AORCharacter(const FObjectInitializer& ObjectInitializer)
	: Super(ObjectInitializer.SetDefaultSubobjectClass<UORCharacterMovementComponent>(
		ACharacter::CharacterMovementComponentName))
{
	PrimaryActorTick.bCanEverTick = true;

	ORMovement = Cast<UORCharacterMovementComponent>(GetCharacterMovement());

	GetCapsuleComponent()->InitCapsuleSize(34.f, 88.f);

	// Double jump, as in the prototype.
	JumpMaxCount = 2;

	bUseControllerRotationYaw = false;

	// Side-scrolling race: the racer faces the direction of travel and the
	// camera sits off to the side.
	if (UORCharacterMovementComponent* Move = ORMovement)
	{
		Move->bOrientRotationToMovement = true;
		Move->RotationRate = FRotator(0.f, 900.f, 0.f);
		Move->bConstrainToPlane = true;
		Move->bSnapToPlaneAtStart = true;
		Move->SetPlaneConstraintNormal(FVector(0.f, 1.f, 0.f));
	}

	CameraBoom = CreateDefaultSubobject<USpringArmComponent>(TEXT("CameraBoom"));
	CameraBoom->SetupAttachment(RootComponent);
	CameraBoom->TargetArmLength = 900.f;
	CameraBoom->SetRelativeRotation(FRotator(0.f, -90.f, 0.f));
	CameraBoom->bDoCollisionTest = false;
	CameraBoom->bInheritPitch = false;
	CameraBoom->bInheritYaw = false;
	CameraBoom->bInheritRoll = false;
	CameraBoom->bEnableCameraLag = true;
	CameraBoom->CameraLagSpeed = 8.f;

	SideViewCamera = CreateDefaultSubobject<UCameraComponent>(TEXT("SideViewCamera"));
	SideViewCamera->SetupAttachment(CameraBoom, USpringArmComponent::SocketName);
	SideViewCamera->bUsePawnControlRotation = false;
}

void AORCharacter::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
	Super::GetLifetimeReplicatedProps(OutLifetimeProps);
	DOREPLIFETIME(AORCharacter, StunRemaining);
}

void AORCharacter::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);

	if (InvulnerableRemaining > 0.f)
	{
		InvulnerableRemaining = FMath::Max(0.f, InvulnerableRemaining - DeltaSeconds);
	}

	// Only the authority counts the stun down; it replicates to the clients.
	if (HasAuthority() && StunRemaining > 0.f)
	{
		StunRemaining = FMath::Max(0.f, StunRemaining - DeltaSeconds);
	}
}

void AORCharacter::MoveRight(float Value)
{
	if (IsStunned())
	{
		return;
	}
	// Side-scroller: the track runs along world +X.
	AddMovementInput(FVector(1.f, 0.f, 0.f), Value);
}

void AORCharacter::StartSliding()
{
	if (IsStunned() || !ORMovement)
	{
		return;
	}
	ORMovement->SetWantsToSlide(true);
}

void AORCharacter::StopSliding()
{
	if (ORMovement)
	{
		ORMovement->SetWantsToSlide(false);
	}
}

void AORCharacter::ApplyStun(float Duration, const FVector& Knockback)
{
	if (!HasAuthority() || IsInvulnerable())
	{
		return;
	}

	StunRemaining = Duration;
	InvulnerableRemaining = Duration + HazardInvulnerability;

	if (ORMovement)
	{
		ORMovement->SetWantsToSlide(false);
		ORMovement->AddBoost(-ORMovement->GetBoostRemaining());
	}

	LaunchCharacter(Knockback, true, false);
	OnRep_Stun();
}

void AORCharacter::OnRep_Stun()
{
	// Hook for VFX / animation. Deliberately empty for now.
}
