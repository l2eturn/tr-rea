// Input. Uses the legacy axis/action bindings from Config/DefaultInput.ini so
// the project compiles and plays with no .uasset content at all. See
// docs/UNREAL.md for migrating to Enhanced Input once you are in the editor.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/PlayerController.h"
#include "ORPlayerController.generated.h"

UCLASS()
class OFFLINERACER_API AORPlayerController : public APlayerController
{
	GENERATED_BODY()

public:
	AORPlayerController();

protected:
	virtual void SetupInputComponent() override;

	void OnMoveRight(float Value);
	void OnJumpPressed();
	void OnJumpReleased();
	void OnSlidePressed();
	void OnSlideReleased();
	void OnRestartPressed();

	class AORCharacter* GetRacer() const;
};
