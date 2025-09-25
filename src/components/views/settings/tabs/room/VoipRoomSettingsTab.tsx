/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useCallback, useMemo, useState } from "react";
import { JoinRule, EventType, type RoomState, type Room } from "matrix-js-sdk/src/matrix";
import { type RoomPowerLevelsEventContent } from "matrix-js-sdk/src/types";

import { _t } from "../../../../../languageHandler";
import LabelledToggleSwitch from "../../../elements/LabelledToggleSwitch";
import { SettingsSubsection } from "../../shared/SettingsSubsection";
import SettingsTab from "../SettingsTab";
import { useRoomState } from "../../../../../hooks/useRoomState";
import SdkConfig, { DEFAULTS } from "../../../../../SdkConfig";
import { SettingsSection } from "../../shared/SettingsSection";
import { ElementCallEventType, ElementCallMemberEventType, ElementCallSettingsEventType, type ElementCallSettingsContent } from "../../../../../call-types";

interface ElementCallSwitchProps {
    room: Room;
}

const ElementCallSwitch: React.FC<ElementCallSwitchProps> = ({ room }) => {
    const isPublic = useMemo(() => room.getJoinRule() === JoinRule.Public, [room]);
    const [content, maySend] = useRoomState(
        room,
        useCallback(
            (state: RoomState) => {
                const content = state
                    ?.getStateEvents(EventType.RoomPowerLevels, "")
                    ?.getContent<RoomPowerLevelsEventContent>();
                return [
                    content ?? {},
                    state?.maySendStateEvent(EventType.RoomPowerLevels, room.client.getSafeUserId()),
                ] as const;
            },
            [room.client],
        ),
    );

    const [elementCallEnabled, setElementCallEnabled] = useState<boolean>(() => {
        return content.events?.[ElementCallMemberEventType.name] === 0;
    });

    const onChange = useCallback(
        (enabled: boolean): void => {
            setElementCallEnabled(enabled);

            // Take a copy to avoid mutating the original
            const newContent = { events: {}, ...content };

            if (enabled) {
                const userLevel = newContent.events[EventType.RoomMessage] ?? content.users_default ?? 0;
                const moderatorLevel = content.kick ?? 50;

                newContent.events[ElementCallEventType.name] = isPublic ? moderatorLevel : userLevel;
                newContent.events[ElementCallMemberEventType.name] = userLevel;
            } else {
                const adminLevel = newContent.events[EventType.RoomPowerLevels] ?? content.state_default ?? 100;

                newContent.events[ElementCallEventType.name] = adminLevel;
                newContent.events[ElementCallMemberEventType.name] = adminLevel;
            }

            room.client.sendStateEvent(room.roomId, EventType.RoomPowerLevels, newContent);
        },
        [room.client, room.roomId, content, isPublic],
    );

    const brand = SdkConfig.get("element_call").brand ?? DEFAULTS.element_call.brand;

    return (
        <LabelledToggleSwitch
            data-testid="element-call-switch"
            label={_t("room_settings|voip|enable_element_call_label", { brand })}
            caption={_t("room_settings|voip|enable_element_call_caption", {
                brand,
            })}
            value={elementCallEnabled}
            onChange={onChange}
            disabled={!maySend}
            tooltip={_t("room_settings|voip|enable_element_call_no_permissions_tooltip")}
        />
    );
};

interface ElementCallSettingsSwitchProps {
    room: Room;
}

const ElementCallSettingsSwitch: React.FC<ElementCallSettingsSwitchProps> = ({ room }) => {
    const [callSettings, maySendSettings] = useRoomState(
        room,
        useCallback(
            (state: RoomState) => {
                const settingsEvent = state.getStateEvents(ElementCallSettingsEventType, "");
                const content = settingsEvent?.getContent<ElementCallSettingsContent>() ?? {};
                return [
                    content,
                    state?.maySendStateEvent(ElementCallSettingsEventType, room.client.getSafeUserId()),
                ] as const;
            },
            [room.client],
        ),
    );

    const [skipLobby, setSkipLobby] = useState<boolean>(callSettings.skipLobby ?? false);
    const [audioMuted, setAudioMuted] = useState<boolean>(callSettings.audioMuted ?? false);

    const onSkipLobbyChange = useCallback(
        (enabled: boolean): void => {
            setSkipLobby(enabled);
            const newContent: ElementCallSettingsContent = { ...callSettings, skipLobby: enabled };
            room.client.sendStateEvent(room.roomId, ElementCallSettingsEventType as any, newContent);
        },
        [room.client, room.roomId, callSettings],
    );

    const onAudioMutedChange = useCallback(
        (enabled: boolean): void => {
            setAudioMuted(enabled);
            const newContent: ElementCallSettingsContent = { ...callSettings, audioMuted: enabled };
            room.client.sendStateEvent(room.roomId, ElementCallSettingsEventType as any, newContent);
        },
        [room.client, room.roomId, callSettings],
    );

    // Update local state when room state changes
    React.useEffect(() => {
        setSkipLobby(callSettings.skipLobby ?? false);
        setAudioMuted(callSettings.audioMuted ?? false);
    }, [callSettings]);

    const noPermissionsTooltip = _t("room_settings|voip|enable_element_call_no_permissions_tooltip");

    return (
        <>
            <LabelledToggleSwitch
                data-testid="skip-lobby-switch"
                label={_t("room_settings|voip|skip_lobby_label")}
                caption={_t("room_settings|voip|skip_lobby_caption")}
                value={skipLobby}
                onChange={onSkipLobbyChange}
                disabled={!maySendSettings}
                tooltip={noPermissionsTooltip}
            />
            <LabelledToggleSwitch
                data-testid="audio-muted-switch"
                label={_t("room_settings|voip|audio_muted_default_label")}
                caption={_t("room_settings|voip|audio_muted_default_caption")}
                value={audioMuted}
                onChange={onAudioMutedChange}
                disabled={!maySendSettings}
                tooltip={noPermissionsTooltip}
            />
        </>
    );
};

interface Props {
    room: Room;
}

export const VoipRoomSettingsTab: React.FC<Props> = ({ room }) => {
    return (
        <SettingsTab>
            <SettingsSection heading={_t("settings|voip|title")}>
                <SettingsSubsection heading={_t("room_settings|voip|call_type_section")}>
                    <ElementCallSwitch room={room} />
                </SettingsSubsection>
                <SettingsSubsection heading={_t("room_settings|voip|call_settings_section")}>
                    <ElementCallSettingsSwitch room={room} />
                </SettingsSubsection>
            </SettingsSection>
        </SettingsTab>
    );
};
