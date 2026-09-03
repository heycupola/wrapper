"use client";

import Link from "next/link";
import { type ComponentType, type SVGProps, useCallback, useEffect, useRef, useState } from "react";
import {
  DEMO_SESSION_ID,
  DEMO_SESSION_TAG,
  DEMO_SHARE_CODE,
  DEMO_SHELL,
  DEMO_HOME_DIR,
  type DemoState,
  type ViewerLink,
  viewerCanConnect,
} from "./demo-session";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowRightCircleFill,
  ArrowsCycle,
  ArrowUp,
  BoltCircleFill,
  CheckCircleFill,
  ChevronLeft,
  ChevronRight,
  Detach,
  DocText,
  Ellipsis,
  ExclamationTriangleFill,
  Gear,
  HandRaised,
  Keyboard,
  LinkBadgePlus,
  LockShieldFill,
  Network,
  PeerToPeer,
  Plus,
  QuestionmarkCircle,
  Spinner,
  Terminal,
  TerminalFill,
  Trash,
  WifiSlash,
} from "./phone-icons";
import { TerminalLines, useStickToBottom, useTerminalInput } from "./terminal-view";
import type { DemoSend } from "./use-demo-session";

const SESSION_CWD = `${DEMO_HOME_DIR}/projects/api`;

/**
 * The viewer, screen for screen: `SessionNavigationView` (list, summary card,
 * empty state), the `ConnectionPreparationView` overlay inside it,
 * `JoinSessionView` and `SettingsView` as sheets, and `TerminalScreen` pushed
 * on the stack. Sheets present the way iOS does: the list shrinks into a card
 * on black while the system status bar stays put above everything.
 */
export function PhoneApp({ state, send }: { state: DemoState; send: DemoSend }) {
  const { screen } = state.viewer;
  const isDetail = screen === "terminal";
  const hasSheet = screen === "join" || screen === "settings";
  const overlay = screen === "ticket" || screen === "denied" || screen === "notConnected";

  return (
    <div
      className={`iosApp ${isDetail ? "isDetail" : ""} ${hasSheet ? "hasSheet" : ""}`}
      data-screen={screen}
    >
      <div className="iosPage iosListPage" inert={isDetail || hasSheet}>
        <SessionsList state={state} send={send} />
        {overlay ? <PreparationOverlay state={state} send={send} /> : null}
      </div>
      <div className="iosPage iosDetailPage" inert={!isDetail}>
        <TerminalScreen state={state} send={send} active={isDetail} />
      </div>
      <div className="iosSheetDim" aria-hidden="true" />
      <div
        className="iosSheet"
        data-open={screen === "join" || undefined}
        inert={screen !== "join"}
      >
        <JoinSheet state={state} send={send} />
      </div>
      <div
        className="iosSheet"
        data-open={screen === "settings" || undefined}
        inert={screen !== "settings"}
      >
        <SettingsSheet send={send} />
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────

/* The iOS 17 status bar on a Dynamic Island phone: the clock centred in the
   left ear, cellular / Wi-Fi / battery centred in the right one, all on the
   island's centre line. Glyph boxes are the system's (19.2, 17.1, 27.4pt). */
function StatusBar({ dark = false }: { dark?: boolean }) {
  return (
    <div className={`iosStatus ${dark ? "isDark" : ""}`} aria-hidden="true">
      <span className="iosStatusTime">9:41</span>
      <span className="iosIsland" />
      <span className="iosStatusIcons">
        <svg className="iosSignal" viewBox="0 0 19.2 12.2" fill="currentColor">
          <rect x="0" y="7.9" width="3.6" height="4.3" rx="1.1" />
          <rect x="5.2" y="5.4" width="3.6" height="6.8" rx="1.1" />
          <rect x="10.4" y="2.9" width="3.6" height="9.3" rx="1.1" />
          <rect x="15.6" y="0" width="3.6" height="12.2" rx="1.1" />
        </svg>
        <svg className="iosWifi" viewBox="0 0 17.1 12.2" fill="currentColor">
          <path
            d="M1.1 4.7a10.6 10.6 0 0 1 14.9 0"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.3"
            strokeLinecap="round"
          />
          <path
            d="M4 7.6a6.5 6.5 0 0 1 9.1 0"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.3"
            strokeLinecap="round"
          />
          <path d="M8.55 12.2 5.9 9.55a3.75 3.75 0 0 1 5.3 0z" />
        </svg>
        <svg className="iosBattery" viewBox="0 0 27.4 13" fill="currentColor">
          <rect
            x="0.5"
            y="0.5"
            width="24"
            height="12"
            rx="3.8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            opacity="0.4"
          />
          <rect x="2" y="2" width="21" height="9" rx="2.5" />
          <path d="M25.6 4.4a1.9 1.9 0 0 1 0 4.2z" opacity="0.4" />
        </svg>
      </span>
    </div>
  );
}

/* The list's toolbar (gearshape / plus) and large title. */
function ListNavBar({
  send,
  disabled = false,
  dark = false,
}: {
  send: DemoSend;
  disabled?: boolean;
  dark?: boolean;
}) {
  return (
    <>
      <nav className={`iosNavBar ${dark ? "isDark" : ""}`} aria-label="Terminals toolbar">
        <button
          type="button"
          className="iosNavButton"
          aria-label="Settings"
          disabled={disabled}
          onClick={() => send({ type: "openSettings" })}
        >
          <Gear />
        </button>
        <button
          type="button"
          className="iosNavButton"
          aria-label="Join a session"
          disabled={disabled}
          onClick={() => send({ type: "openJoin" })}
        >
          <Plus />
        </button>
      </nav>
      <h2 className="iosLargeTitle">Terminals</h2>
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Terminals list

function SessionsList({ state, send }: { state: DemoState; send: DemoSend }) {
  const sessions = viewerCanConnect(state) ? 1 : 0;
  return (
    <>
      <StatusBar />
      <ListNavBar send={send} />

      <div className="iosList">
        <section className="iosGroup iosSummary" aria-label="Session availability">
          <BoltCircleFill className="iosSummaryIcon" />
          <div className="iosSummaryText">
            <strong key={sessions} className="iosNumeric">
              {sessions === 1 ? "1 terminal ready" : `${sessions} terminals ready`}
            </strong>
            <small>Pull to refresh shared sessions</small>
          </div>
          <span className="iosCapsule iosActiveCount" key={`active-${sessions}`}>
            {sessions} active
          </span>
        </section>

        {sessions === 0 ? (
          <section className="iosGroup isClear iosEmpty">
            <Terminal className="iosEmptyIcon" />
            <strong>No active sessions</strong>
            <p>Start Wrapper on your computer, then share a session to connect.</p>
            <button
              type="button"
              className="iosProminent"
              onClick={() => send({ type: "openJoin" })}
            >
              <Plus /> Join with a code
            </button>
          </section>
        ) : (
          <>
            <h3 className="iosSectionHeader">Sessions</h3>
            <section className="iosGroup">
              <button
                type="button"
                className="iosRow"
                onClick={() => send({ type: "tapSession" })}
                aria-label={`Session ${DEMO_SESSION_TAG}, ${SESSION_CWD}`}
              >
                <span className="iosRowIcon">
                  <TerminalFill />
                </span>
                <span className="iosRowText">
                  <strong>{DEMO_SESSION_TAG}</strong>
                  <span className="iosRowCwd">{SESSION_CWD}</span>
                  <span className="iosRowMeta">
                    {DEMO_SHELL} <i aria-hidden="true">•</i> Tap to connect
                  </span>
                </span>
                <span className="iosRowTrailing">
                  <span className="iosBadge isReady">
                    <CheckCircleFill /> Ready
                  </span>
                  <ChevronRight className="iosRowChevron" />
                </span>
              </button>
            </section>
          </>
        )}
      </div>
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// ConnectionPreparationView

/* In the app this sits in the list's ZStack, under the navigation bar: the
   bar and its title stay on screen above the dark panel. */
function PreparationOverlay({ state, send }: { state: DemoState; send: DemoSend }) {
  const { screen } = state.viewer;
  const copy =
    screen === "ticket"
      ? { title: "Requesting secure ticket", detail: "Authorizing this device with Convex." }
      : screen === "denied"
        ? { title: "Could not authorize session", detail: "This session is no longer shared." }
        : {
            title: "Session is not connected",
            detail: "Request a fresh relay ticket to continue.",
          };
  const canRetry = screen !== "ticket";

  return (
    <div className="iosPrep">
      <StatusBar dark />
      <ListNavBar send={send} disabled dark />
      <div className="iosPrepBody">
        {canRetry ? (
          <ExclamationTriangleFill className="iosPrepWarn" />
        ) : (
          <Spinner className="isLarge" />
        )}
        <div className="iosPrepText">
          <strong>{copy.title}</strong>
          <p>{copy.detail}</p>
        </div>
        <div className="iosPrepActions">
          <button type="button" className="iosBordered" onClick={() => send({ type: "tapCancel" })}>
            Cancel
          </button>
          {canRetry ? (
            <button
              type="button"
              className="iosProminent"
              onClick={() => send({ type: "tapRetry" })}
            >
              Retry
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Sheets

/* Inline-title bar of a sheet's NavigationStack. Leading and trailing slots
   mirror each other so the title stays centred. */
function SheetNavBar({
  title,
  leadingLabel,
  trailingLabel,
  onLeading,
  onTrailing,
}: {
  title: string;
  leadingLabel?: string;
  trailingLabel?: string;
  onLeading?: () => void;
  onTrailing?: () => void;
}) {
  return (
    <nav className="iosNavBar isInline" aria-label={`${title} toolbar`}>
      {leadingLabel ? (
        <button type="button" className="iosNavText" onClick={onLeading}>
          {leadingLabel}
        </button>
      ) : (
        <span className="iosNavSpacer" aria-hidden="true">
          {trailingLabel}
        </span>
      )}
      <strong className="iosInlineTitle">{title}</strong>
      {trailingLabel ? (
        <button type="button" className="iosNavText isBold" onClick={onTrailing}>
          {trailingLabel}
        </button>
      ) : (
        <span className="iosNavSpacer" aria-hidden="true">
          {leadingLabel}
        </span>
      )}
    </nav>
  );
}

// JoinSessionView

function JoinSheet({ state, send }: { state: DemoState; send: DemoSend }) {
  const shared = viewerCanConnect(state);
  return (
    <div className="iosFormSheet">
      <SheetNavBar
        title="Join session"
        leadingLabel="Cancel"
        onLeading={() => send({ type: "closeJoin" })}
      />
      <div className="iosList iosForm">
        <section className="iosGroup isClear iosJoinHero">
          <span className="iosJoinIcon">
            <LinkBadgePlus />
          </span>
          <strong>Join a shared terminal</strong>
          <p>Enter the invitation shown by the host.</p>
        </section>

        <h3 className="iosSectionHeader">Invitation</h3>
        <section className="iosGroup">
          {/* TextFields in a Form show only their prompt until filled. */}
          <span
            className={`iosCell iosField ${shared ? "" : "isPlaceholder"}`}
            aria-label="Session ID"
          >
            {shared ? DEMO_SESSION_ID : "ABC123XYZ789"}
          </span>
          <span
            className={`iosCell iosField ${shared ? "" : "isPlaceholder"}`}
            aria-label="Share code"
          >
            {shared ? DEMO_SHARE_CODE : "ABCD-EFGH"}
          </span>
        </section>
        <p className="iosSectionFooter">
          {shared
            ? "Filled in from the invite your Mac just printed."
            : "The host displays both values after sharing the terminal."}
        </p>

        <section className="iosGroup iosFootnote isLabel">
          <LockShieldFill />
          <p>The share code is used only for backend verification and is never written to logs.</p>
        </section>

        <button
          type="button"
          className="iosProminent isWide"
          disabled={!shared}
          onClick={() => send({ type: "submitJoin" })}
        >
          <ArrowRightCircleFill /> Join securely
        </button>
      </div>
    </div>
  );
}

// SettingsView

function SettingsSheet({ send }: { send: DemoSend }) {
  return (
    <div className="iosFormSheet">
      <SheetNavBar
        title="Settings"
        trailingLabel="Done"
        onTrailing={() => send({ type: "closeSettings" })}
      />
      <div className="iosList iosForm">
        <section className="iosGroup">
          <div className="iosCell">
            <span>Release</span>
            <span className="iosCellValue">Viewer beta</span>
          </div>
          <div className="iosCell">
            <span>Distribution</span>
            <span className="iosCellValue">TestFlight</span>
          </div>
        </section>
        <p className="iosSectionFooter">
          The iOS app is a TestFlight viewer. The shell, files, and credentials stay on the host
          computer.
        </p>

        <h3 className="iosSectionHeader">Privacy and security</h3>
        <section className="iosGroup">
          <Link href="/privacy-policy" className="iosCell isLink">
            <HandRaised /> Privacy Policy
          </Link>
          <Link href="/terms-of-service" className="iosCell isLink">
            <DocText /> Terms of Service
          </Link>
          <Link href="/support" className="iosCell isLink">
            <QuestionmarkCircle /> Support
          </Link>
          <div className="iosCell">
            <span>Transport</span>
            <span className="iosCellValue">P2P with relay fallback</span>
          </div>
        </section>

        <section className="iosGroup iosFootnote">
          <p>
            Direct P2P can reveal peer IP addresses. Relay fallback is encrypted in transit but is
            not zero knowledge.
          </p>
        </section>

        <h3 className="iosSectionHeader">Account</h3>
        <section className="iosGroup">
          <button type="button" className="iosCell isLink" disabled>
            <Detach /> Sign out
          </button>
          <button type="button" className="iosCell isLink isDestructive" disabled>
            <Trash /> Delete account
          </button>
        </section>
        <p className="iosSectionFooter">
          Account deletion permanently removes your Wrapper account and associated session metadata.
        </p>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// TerminalScreen

const LINK_META: Record<ViewerLink, { label: string; description: string; Icon: typeof Network }> =
  {
    connecting: { label: "CONNECTING", description: "Connecting securely", Icon: ArrowsCycle },
    relay: { label: "RELAY", description: "Connected through relay", Icon: Network },
    p2p: { label: "P2P", description: "Connected peer to peer", Icon: PeerToPeer },
    offline: { label: "OFFLINE", description: "Offline", Icon: WifiSlash },
  };

function TerminalScreen({
  state,
  send,
  active,
}: {
  state: DemoState;
  send: DemoSend;
  active: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [ctrlArmed, setCtrlArmed] = useState(false);
  const releaseCtrl = useCallback(() => setCtrlArmed(false), []);
  const { focus, inputProps } = useTerminalInput("phone", send, {
    ctrlArmed,
    onCtrlConsumed: releaseCtrl,
  });
  const focused = state.focus === "phone";
  const { link } = state.viewer;
  const meta = LINK_META[link];
  useStickToBottom(scrollRef, active ? state.lines.length + state.input.length : 0);

  // Opening the terminal puts the caret in it, as the app does — but only
  // where that does not summon a soft keyboard over the page.
  useEffect(() => {
    if (!active) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const handle = window.setTimeout(focus, 460);
    return () => window.clearTimeout(handle);
  }, [active, focus]);

  const sendKey = (key: string) => send({ type: "key", key });

  return (
    <div className="iosTerminal">
      <StatusBar dark />
      <nav className="iosNavBar isDark" aria-label="Terminal toolbar">
        <button
          type="button"
          className="iosBackButton"
          aria-label="Back to Terminals"
          onClick={() => send({ type: "tapDetach" })}
        >
          <ChevronLeft />
        </button>
        <div
          className="iosPrincipal"
          aria-label={`Session ${DEMO_SESSION_TAG}, ${meta.description}`}
        >
          <strong>{DEMO_SESSION_TAG}</strong>
          <span className="iosLink" data-link={link}>
            <meta.Icon /> {meta.label}
          </span>
        </div>
        <button
          type="button"
          className="iosNavButton isDestructive"
          aria-label="Detach"
          onClick={() => send({ type: "tapDetach" })}
        >
          <Detach />
        </button>
      </nav>

      <div
        className="iosTerminalBody demoScrollback"
        ref={scrollRef}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          if (window.getSelection()?.toString()) return;
          event.preventDefault();
          focus();
        }}
      >
        <TerminalLines lines={state.lines} input={state.input} cwd={state.cwd} focused={focused} />
        <input {...inputProps} />
        {link === "connecting" ? (
          <div className="iosStage">
            <Spinner className="isLarge" />
            <strong>Connecting to relay</strong>
          </div>
        ) : null}
      </div>

      <div className="iosKeyBar" role="toolbar" aria-label="Terminal keys">
        <KeyCap label="esc" onPress={() => sendKey("Escape")} />
        <KeyCap label="ctrl" pressed={ctrlArmed} onPress={() => setCtrlArmed((value) => !value)} />
        <KeyCap label="tab" onPress={() => sendKey("Tab")} />
        <i className="iosKeySeparator" aria-hidden="true" />
        <KeyCap icon={ArrowLeft} label="Left arrow" onPress={focus} />
        <KeyCap icon={ArrowDown} label="Down arrow" onPress={() => sendKey("ArrowDown")} />
        <KeyCap icon={ArrowUp} label="Up arrow" onPress={() => sendKey("ArrowUp")} />
        <KeyCap icon={ArrowRight} label="Right arrow" onPress={focus} />
        <KeyCap icon={Ellipsis} label="Terminal symbols" onPress={focus} />
        <i className="iosKeySeparator" aria-hidden="true" />
        <KeyCap icon={Keyboard} label="Show keyboard" onPress={focus} />
      </div>
      <i className="iosHomeIndicator" aria-hidden="true" />
    </div>
  );
}

function KeyCap({
  label,
  icon: Icon,
  pressed = false,
  onPress,
}: {
  label: string;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  pressed?: boolean;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      className={`iosKey ${pressed ? "isPressed" : ""} ${Icon ? "isIcon" : ""}`}
      aria-label={Icon ? label : undefined}
      aria-pressed={label === "ctrl" ? pressed : undefined}
      onPointerDown={(event) => event.preventDefault()}
      onClick={onPress}
    >
      {Icon ? <Icon /> : label}
    </button>
  );
}
