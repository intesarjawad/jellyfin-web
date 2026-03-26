import React, {
    useCallback,
    useEffect,
    useRef,
    useState,
    type FC,
    type MouseEvent,
    type TouchEvent as ReactTouchEvent
} from 'react';

import { playbackManager } from 'components/playback/playbackmanager';
import Events, { type Event } from 'utils/events';
import { PlayerEvent } from 'apps/stable/features/playback/constants/playerEvent';
import { TICKS_PER_SECOND } from 'constants/time';
import { OSD_HIDE_DELAY_MS } from '../utils/constants';

// ---------------------------------------------------------------------------
// Tick ↔ seconds helpers
//
// Jellyfin represents playback positions as 100-nanosecond ticks.
// TICKS_PER_SECOND = 10,000,000 (10ms * 1000 * 1000 / 100).
//
// playbackManager.getCurrentTicks()  → ticks
// playbackManager.duration()         → ticks (RunTimeTicks or player.duration() * 10000)
// playbackManager.getBufferedRanges() → [{ start: ticks, end: ticks }]
// ---------------------------------------------------------------------------

function ticksToSeconds(ticks: number): number {
    return ticks / TICKS_PER_SECOND;
}

function secondsToTicks(seconds: number): number {
    return Math.floor(seconds * TICKS_PER_SECOND);
}

function formatTime(totalSeconds: number): string {
    const safeSeconds = Math.max(0, Math.floor(totalSeconds));
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const seconds = safeSeconds % 60;

    const mm = String(minutes).padStart(2, '0');
    const ss = String(seconds).padStart(2, '0');

    if (hours > 0) {
        return `${hours}:${mm}:${ss}`;
    }
    return `${mm}:${ss}`;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MediaStreamTrack {
    Index: number;
    Language?: string;
    DisplayTitle?: string;
    Type: string;
}

interface BufferedRange {
    start: number;
    end: number;
}

interface PlayerOSDProps {
    /** Invoked when the user presses the back button. */
    onBack: () => void;
}

type OpenPopover = 'subtitles' | 'audio' | null;

// ---------------------------------------------------------------------------
// PlayerOSD
// ---------------------------------------------------------------------------

/**
 * Glass overlay rendered on top of the native Jellyfin video element.
 *
 * Design contract:
 *   - Progress bar width and scrub handle are updated via direct DOM mutation
 *     in a requestAnimationFrame loop — NOT via setState — to avoid React
 *     reconciliation overhead at 60fps.
 *   - Visibility (auto-hide) uses a CSS class toggle, also without setState,
 *     so the render tree is not re-evaluated on every mouse move.
 *   - React state is reserved for data that genuinely changes the rendered
 *     structure: isPaused, mediaTitle, track lists, open popovers.
 */
const PlayerOSD: FC<Readonly<PlayerOSDProps>> = ({ onBack }) => {
    // -- State: structural changes only -------------------------------------
    const [ isPaused, setIsPaused ] = useState(true);
    const [ titlePrimary, setTitlePrimary ] = useState('');
    const [ titleSecondary, setTitleSecondary ] = useState('');
    const [ subtitleTracks, setSubtitleTracks ] = useState<MediaStreamTrack[]>([]);
    const [ audioTracks, setAudioTracks ] = useState<MediaStreamTrack[]>([]);
    const [ activeSubtitleIndex, setActiveSubtitleIndex ] = useState(-1);
    const [ activeAudioIndex, setActiveAudioIndex ] = useState(-1);
    const [ openPopover, setOpenPopover ] = useState<OpenPopover>(null);

    // -- Refs: DOM access and mutable state without re-renders --------------
    const osdRef = useRef<HTMLDivElement>(null);
    const progressPlayedRef = useRef<HTMLDivElement>(null);
    const progressBufferedRef = useRef<HTMLDivElement>(null);
    const progressHandleRef = useRef<HTMLDivElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const timeCurrentRef = useRef<HTMLSpanElement>(null);
    const timeTotalRef = useRef<HTMLSpanElement>(null);

    // Auto-hide timer and scrubbing state
    const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isScrubbing = useRef(false);
    const rafHandleRef = useRef<number | null>(null);
    const isOsdVisible = useRef(true);

    // ---------------------------------------------------------------------------
    // Auto-hide logic — mutates CSS class directly, no setState
    // ---------------------------------------------------------------------------

    const showOsd = useCallback(() => {
        const osd = osdRef.current;
        if (!osd) return;

        if (!isOsdVisible.current) {
            isOsdVisible.current = true;
            osd.classList.remove('sb-osd--hidden');
            osd.classList.add('sb-osd--visible');
            document.body.classList.remove('sb-osd--cursor-hidden');
        }

        if (hideTimerRef.current !== null) {
            clearTimeout(hideTimerRef.current);
        }

        // Do not schedule hide while the user is scrubbing
        if (!isScrubbing.current) {
            hideTimerRef.current = setTimeout(() => {
                const osdEl = osdRef.current;
                if (osdEl) {
                    isOsdVisible.current = false;
                    osdEl.classList.remove('sb-osd--visible');
                    osdEl.classList.add('sb-osd--hidden');
                    document.body.classList.add('sb-osd--cursor-hidden');
                }
            }, OSD_HIDE_DELAY_MS);
        }
    }, []);

    const cancelHide = useCallback(() => {
        if (hideTimerRef.current !== null) {
            clearTimeout(hideTimerRef.current);
            hideTimerRef.current = null;
        }
    }, []);

    // ---------------------------------------------------------------------------
    // RAF loop: progress bar + time display
    //
    // All duration values from playbackManager are in TICKS.
    // getBufferedRanges returns { start: ticks, end: ticks }.
    // ---------------------------------------------------------------------------

    const updateProgressDOM = useCallback(() => {
        rafHandleRef.current = requestAnimationFrame(updateProgressDOM);

        const player = playbackManager.getCurrentPlayer();
        if (!player) return;

        let currentTicks: number;
        try {
            currentTicks = playbackManager.getCurrentTicks(player) ?? 0;
        } catch {
            currentTicks = 0;
        }

        const durationTicks = playbackManager.duration(player) ?? 0;
        const progressFraction = durationTicks > 0 ? currentTicks / durationTicks : 0;
        const playedPercent = `${(progressFraction * 100).toFixed(3)}%`;

        if (progressPlayedRef.current) {
            progressPlayedRef.current.style.width = playedPercent;
        }
        if (progressHandleRef.current) {
            progressHandleRef.current.style.left = playedPercent;
        }

        // Buffered ranges — end is in ticks, compare against durationTicks
        const bufferedRanges = playbackManager.getBufferedRanges(player) as BufferedRange[];
        if (progressBufferedRef.current && bufferedRanges.length > 0) {
            const lastRange = bufferedRanges[bufferedRanges.length - 1];
            const bufferedFraction = durationTicks > 0 ?
                lastRange.end / durationTicks :
                0;
            progressBufferedRef.current.style.width =
                `${Math.min(bufferedFraction * 100, 100).toFixed(3)}%`;
        }

        // Time display — direct DOM text mutation avoids React re-renders
        if (timeCurrentRef.current) {
            timeCurrentRef.current.textContent = formatTime(ticksToSeconds(currentTicks));
        }
        if (timeTotalRef.current) {
            timeTotalRef.current.textContent = formatTime(ticksToSeconds(durationTicks));
        }
    }, []);

    // ---------------------------------------------------------------------------
    // Scrub bar interaction
    // ---------------------------------------------------------------------------

    function seekToProgressFraction(fraction: number) {
        const player = playbackManager.getCurrentPlayer();
        if (!player) return;

        const durationTicks = playbackManager.duration(player) ?? 0;
        const targetTicks = Math.floor(fraction * durationTicks);
        playbackManager.seek(targetTicks, player);
    }

    function getFractionFromPointerX(clientX: number): number {
        const track = progressPlayedRef.current?.parentElement;
        if (!track) return 0;
        const rect = track.getBoundingClientRect();
        return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    }

    function updateTooltipPosition(clientX: number, fraction: number) {
        const tooltip = tooltipRef.current;
        const track = progressPlayedRef.current?.parentElement;
        if (!tooltip || !track) return;

        const rect = track.getBoundingClientRect();
        tooltip.textContent = formatTime(
            ticksToSeconds((playbackManager.duration(playbackManager.getCurrentPlayer()) ?? 0) * fraction)
        );
        tooltip.style.left = `${clientX - rect.left}px`;
    }

    const handleProgressMouseMove = useCallback((e: MouseEvent<HTMLDivElement>) => {
        const fraction = getFractionFromPointerX(e.clientX);
        updateTooltipPosition(e.clientX, fraction);

        if (isScrubbing.current) {
            seekToProgressFraction(fraction);
            if (progressPlayedRef.current) {
                progressPlayedRef.current.style.width = `${fraction * 100}%`;
            }
            if (progressHandleRef.current) {
                progressHandleRef.current.style.left = `${fraction * 100}%`;
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleProgressMouseDown = useCallback((e: MouseEvent<HTMLDivElement>) => {
        isScrubbing.current = true;
        cancelHide();
        seekToProgressFraction(getFractionFromPointerX(e.clientX));

        const onMouseUp = () => {
            isScrubbing.current = false;
            showOsd();
            window.removeEventListener('mouseup', onMouseUp);
        };
        window.addEventListener('mouseup', onMouseUp);
    }, [ cancelHide, showOsd ]);

    const handleProgressTouchStart = useCallback((e: ReactTouchEvent<HTMLDivElement>) => {
        isScrubbing.current = true;
        cancelHide();
        seekToProgressFraction(getFractionFromPointerX(e.touches[0].clientX));

        const onTouchEnd = () => {
            isScrubbing.current = false;
            showOsd();
            window.removeEventListener('touchend', onTouchEnd);
        };
        window.addEventListener('touchend', onTouchEnd);
    }, [ cancelHide, showOsd ]);

    const handleProgressTouchMove = useCallback((e: ReactTouchEvent<HTMLDivElement>) => {
        if (!isScrubbing.current) return;
        const fraction = getFractionFromPointerX(e.touches[0].clientX);
        seekToProgressFraction(fraction);

        if (progressPlayedRef.current) {
            progressPlayedRef.current.style.width = `${fraction * 100}%`;
        }
        if (progressHandleRef.current) {
            progressHandleRef.current.style.left = `${fraction * 100}%`;
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ---------------------------------------------------------------------------
    // Playback control handlers
    // ---------------------------------------------------------------------------

    const SKIP_BACK_S = 10;
    const SKIP_FORWARD_S = 30;

    const handlePlayPause = useCallback(() => {
        playbackManager.playPause();
        showOsd();
    }, [ showOsd ]);

    const handleSkipBack = useCallback(() => {
        const player = playbackManager.getCurrentPlayer();
        if (!player) return;
        const currentTicks = playbackManager.getCurrentTicks(player) ?? 0;
        playbackManager.seek(Math.max(0, currentTicks - secondsToTicks(SKIP_BACK_S)), player);
        showOsd();
    }, [ showOsd ]);

    const handleSkipForward = useCallback(() => {
        const player = playbackManager.getCurrentPlayer();
        if (!player) return;
        const currentTicks = playbackManager.getCurrentTicks(player) ?? 0;
        const durationTicks = playbackManager.duration(player) ?? 0;
        playbackManager.seek(
            Math.min(currentTicks + secondsToTicks(SKIP_FORWARD_S), durationTicks),
            player
        );
        showOsd();
    }, [ showOsd ]);

    const handleVolumeUp = useCallback(() => {
        const player = playbackManager.getCurrentPlayer();
        if (!player) return;
        const currentVolume = playbackManager.getVolume(player) ?? 100;
        playbackManager.setVolume(Math.min(currentVolume + 10, 100), player);
        showOsd();
    }, [ showOsd ]);

    const handleVolumeDown = useCallback(() => {
        const player = playbackManager.getCurrentPlayer();
        if (!player) return;
        const currentVolume = playbackManager.getVolume(player) ?? 100;
        playbackManager.setVolume(Math.max(currentVolume - 10, 0), player);
        showOsd();
    }, [ showOsd ]);

    const handleMuteToggle = useCallback(() => {
        const player = playbackManager.getCurrentPlayer();
        if (!player) return;
        playbackManager.setMute(!playbackManager.isMuted(player), player);
        showOsd();
    }, [ showOsd ]);

    const handleFullscreenToggle = useCallback(() => {
        playbackManager.toggleFullscreen();
        showOsd();
    }, [ showOsd ]);

    const handleSubtitleSelect = useCallback((index: number) => {
        const player = playbackManager.getCurrentPlayer();
        if (!player) return;
        playbackManager.setSubtitleStreamIndex(index, player);
        setActiveSubtitleIndex(index);
        setOpenPopover(null);
    }, []);

    const handleAudioSelect = useCallback((index: number) => {
        const player = playbackManager.getCurrentPlayer();
        if (!player) return;
        playbackManager.setAudioStreamIndex(index, player);
        setActiveAudioIndex(index);
        setOpenPopover(null);
    }, []);

    // ---------------------------------------------------------------------------
    // Keyboard shortcuts
    // ---------------------------------------------------------------------------

    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

            switch (e.key) {
                case ' ':
                case 'k':
                    e.preventDefault();
                    handlePlayPause();
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    handleSkipBack();
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    handleSkipForward();
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    handleVolumeUp();
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    handleVolumeDown();
                    break;
                case 'f':
                case 'F':
                    handleFullscreenToggle();
                    break;
                case 'm':
                case 'M':
                    handleMuteToggle();
                    break;
                default:
                    break;
            }

            showOsd();
        }

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [
        handlePlayPause,
        handleSkipBack,
        handleSkipForward,
        handleVolumeUp,
        handleVolumeDown,
        handleFullscreenToggle,
        handleMuteToggle,
        showOsd
    ]);

    // ---------------------------------------------------------------------------
    // Mouse / touch activity → show OSD
    // ---------------------------------------------------------------------------

    useEffect(() => {
        const handleMouseMove = () => showOsd();
        const handleTouchStart = () => showOsd();

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('touchstart', handleTouchStart);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('touchstart', handleTouchStart);
        };
    }, [ showOsd ]);

    // ---------------------------------------------------------------------------
    // playbackManager event bindings
    // ---------------------------------------------------------------------------

    useEffect(() => {
        function syncTrackState(player: unknown) {
            try {
                const rawSubtitleTracks =
                    playbackManager.subtitleTracks(player) as MediaStreamTrack[] | undefined;
                const rawAudioTracks =
                    playbackManager.audioTracks(player) as MediaStreamTrack[] | undefined;
                const currentSubtitleIndex =
                    playbackManager.getSubtitleStreamIndex(player) as number;
                const currentAudioIndex =
                    playbackManager.getAudioStreamIndex(player) as number;

                setSubtitleTracks(rawSubtitleTracks ?? []);
                setAudioTracks(rawAudioTracks ?? []);
                setActiveSubtitleIndex(currentSubtitleIndex ?? -1);
                setActiveAudioIndex(currentAudioIndex ?? -1);
            } catch {
                // Player may not yet be initialised
            }
        }

        function onPlaybackStart(
            _e: Event,
            player: unknown,
            state: { NowPlayingItem?: { Name?: string; SeriesName?: string; EpisodeTitle?: string } }
        ) {
            const item = state?.NowPlayingItem;
            if (item) {
                const isEpisode = Boolean(item.SeriesName);
                setTitlePrimary(
                    isEpisode ? (item.EpisodeTitle ?? item.Name ?? '') : (item.Name ?? '')
                );
                setTitleSecondary(isEpisode ? (item.Name ?? '') : '');
            }
            setIsPaused(false);
            syncTrackState(player);
            showOsd();
        }

        function onPlaybackStop() {
            setIsPaused(true);
        }

        function onPause() {
            setIsPaused(true);
            showOsd();
        }

        function onUnpause() {
            setIsPaused(false);
            showOsd();
        }

        function onMediaStreamsChange() {
            const player = playbackManager.getCurrentPlayer();
            if (player) syncTrackState(player);
        }

        function bindToPlayer(player: unknown) {
            if (!player) return;
            Events.on(player, PlayerEvent.PlaybackStart, onPlaybackStart);
            Events.on(player, PlayerEvent.PlaybackStop, onPlaybackStop);
            Events.on(player, PlayerEvent.Pause, onPause);
            Events.on(player, PlayerEvent.Unpause, onUnpause);
            Events.on(player, PlayerEvent.MediaStreamsChange, onMediaStreamsChange);
        }

        function unbindFromPlayer(player: unknown) {
            if (!player) return;
            Events.off(player, PlayerEvent.PlaybackStart, onPlaybackStart);
            Events.off(player, PlayerEvent.PlaybackStop, onPlaybackStop);
            Events.off(player, PlayerEvent.Pause, onPause);
            Events.off(player, PlayerEvent.Unpause, onUnpause);
            Events.off(player, PlayerEvent.MediaStreamsChange, onMediaStreamsChange);
        }

        // Manager-level events (fire on playbackManager itself, not the player)
        Events.on(playbackManager, 'playbackstart', onPlaybackStart);
        Events.on(playbackManager, 'playbackstop', onPlaybackStop);

        const initialPlayer = playbackManager.getCurrentPlayer();
        bindToPlayer(initialPlayer);

        function onPlayerChange(
            _e: Event,
            newPlayer: unknown,
            _target: unknown,
            previousPlayer: unknown
        ) {
            unbindFromPlayer(previousPlayer);
            bindToPlayer(newPlayer);
        }

        Events.on(playbackManager, 'playerchange', onPlayerChange);

        // Start RAF loop
        rafHandleRef.current = requestAnimationFrame(updateProgressDOM);

        showOsd();

        return () => {
            Events.off(playbackManager, 'playbackstart', onPlaybackStart);
            Events.off(playbackManager, 'playbackstop', onPlaybackStop);
            Events.off(playbackManager, 'playerchange', onPlayerChange);
            unbindFromPlayer(playbackManager.getCurrentPlayer());

            if (rafHandleRef.current !== null) {
                cancelAnimationFrame(rafHandleRef.current);
            }
            if (hideTimerRef.current !== null) {
                clearTimeout(hideTimerRef.current);
            }

            // Clean up cursor class if component unmounts while hidden
            document.body.classList.remove('sb-osd--cursor-hidden');
        };
    }, [ showOsd, updateProgressDOM ]);

    // ---------------------------------------------------------------------------
    // Close popovers when clicking outside the OSD
    // ---------------------------------------------------------------------------

    useEffect(() => {
        if (!openPopover) return;

        function handleOutsideClick(e: globalThis.MouseEvent) {
            const osd = osdRef.current;
            if (osd && !osd.contains(e.target as Node)) {
                setOpenPopover(null);
            }
        }

        document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, [ openPopover ]);

    // ---------------------------------------------------------------------------
    // Render helpers
    // ---------------------------------------------------------------------------

    function renderSubtitlePopover() {
        return (
            <div className='sb-osd__track-popover' role='listbox' aria-label='Subtitle track'>
                <button
                    className={`sb-osd__track-item${activeSubtitleIndex === -1 ? ' sb-osd__track-item--active' : ''}`}
                    onClick={() => handleSubtitleSelect(-1)}
                    role='option'
                    aria-selected={activeSubtitleIndex === -1}
                >
                    <span className='sb-osd__track-item-check'>
                        {activeSubtitleIndex === -1 ? '✓' : ''}
                    </span>
                    Off
                </button>
                {subtitleTracks.map(track => (
                    <button
                        key={track.Index}
                        className={`sb-osd__track-item${activeSubtitleIndex === track.Index ? ' sb-osd__track-item--active' : ''}`}
                        onClick={() => handleSubtitleSelect(track.Index)}
                        role='option'
                        aria-selected={activeSubtitleIndex === track.Index}
                    >
                        <span className='sb-osd__track-item-check'>
                            {activeSubtitleIndex === track.Index ? '✓' : ''}
                        </span>
                        {track.DisplayTitle ?? track.Language ?? `Track ${track.Index}`}
                    </button>
                ))}
            </div>
        );
    }

    function renderAudioPopover() {
        return (
            <div className='sb-osd__track-popover' role='listbox' aria-label='Audio track'>
                {audioTracks.map(track => (
                    <button
                        key={track.Index}
                        className={`sb-osd__track-item${activeAudioIndex === track.Index ? ' sb-osd__track-item--active' : ''}`}
                        onClick={() => handleAudioSelect(track.Index)}
                        role='option'
                        aria-selected={activeAudioIndex === track.Index}
                    >
                        <span className='sb-osd__track-item-check'>
                            {activeAudioIndex === track.Index ? '✓' : ''}
                        </span>
                        {track.DisplayTitle ?? track.Language ?? `Track ${track.Index}`}
                    </button>
                ))}
            </div>
        );
    }

    // ---------------------------------------------------------------------------
    // Render
    // ---------------------------------------------------------------------------

    return (
        <div
            ref={osdRef}
            className='sb-osd sb-osd--visible'
            onMouseMove={showOsd}
            onTouchStart={showOsd}
        >
            {/* Top bar */}
            <div className='sb-osd__top'>
                <button
                    className='sb-osd__back-btn'
                    onClick={onBack}
                    aria-label='Back'
                >
                    <svg
                        width='20'
                        height='20'
                        viewBox='0 0 24 24'
                        fill='none'
                        stroke='currentColor'
                        strokeWidth='2.2'
                        strokeLinecap='round'
                        strokeLinejoin='round'
                    >
                        <polyline points='15 18 9 12 15 6' />
                    </svg>
                </button>

                <div className='sb-osd__title-group'>
                    {titleSecondary && (
                        <span className='sb-osd__series-title'>{titleSecondary}</span>
                    )}
                    <span className='sb-osd__episode-title'>{titlePrimary}</span>
                </div>
            </div>

            {/* Center — large tap target for play/pause on touch devices */}
            <div className='sb-osd__center'>
                <button
                    className='sb-osd__play-pause-tap'
                    onClick={handlePlayPause}
                    aria-label={isPaused ? 'Play' : 'Pause'}
                >
                    {isPaused ? (
                        <svg width='28' height='28' viewBox='0 0 24 24' fill='currentColor'>
                            <path d='M8 5v14l11-7z' />
                        </svg>
                    ) : (
                        <svg width='28' height='28' viewBox='0 0 24 24' fill='currentColor'>
                            <path d='M6 19h4V5H6v14zm8-14v14h4V5h-4z' />
                        </svg>
                    )}
                </button>
            </div>

            {/* Bottom bar */}
            <div className='sb-osd__bottom'>
                {/* Progress / scrub bar */}
                <div
                    className='sb-osd__progress'
                    role='slider'
                    aria-label='Playback position'
                    onMouseDown={handleProgressMouseDown}
                    onMouseMove={handleProgressMouseMove}
                    onTouchStart={handleProgressTouchStart}
                    onTouchMove={handleProgressTouchMove}
                >
                    <div className='sb-osd__progress-track'>
                        <div ref={progressBufferedRef} className='sb-osd__progress-buffered' />
                        <div ref={progressPlayedRef} className='sb-osd__progress-played' />
                        <div ref={progressHandleRef} className='sb-osd__progress-handle' />
                    </div>
                    <div
                        ref={tooltipRef}
                        className='sb-osd__progress-tooltip'
                        aria-hidden='true'
                    />
                </div>

                {/* Controls row */}
                <div className='sb-osd__controls'>
                    <div className='sb-osd__controls-left'>
                        {/* Play / pause */}
                        <button
                            className='sb-osd__btn sb-osd__btn--play'
                            onClick={handlePlayPause}
                            aria-label={isPaused ? 'Play' : 'Pause'}
                        >
                            {isPaused ? (
                                <svg width='18' height='18' viewBox='0 0 24 24' fill='currentColor'>
                                    <path d='M8 5v14l11-7z' />
                                </svg>
                            ) : (
                                <svg width='18' height='18' viewBox='0 0 24 24' fill='currentColor'>
                                    <path d='M6 19h4V5H6v14zm8-14v14h4V5h-4z' />
                                </svg>
                            )}
                        </button>

                        {/* Skip back 10s */}
                        <button
                            className='sb-osd__btn'
                            onClick={handleSkipBack}
                            aria-label='Skip back 10 seconds'
                        >
                            <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8'>
                                <path d='M12.5 3a9 9 0 1 0 9 9' strokeLinecap='round' />
                                <polyline points='12.5 3 8 7 12.5 11' />
                            </svg>
                            <span>10</span>
                        </button>

                        {/* Skip forward 30s */}
                        <button
                            className='sb-osd__btn'
                            onClick={handleSkipForward}
                            aria-label='Skip forward 30 seconds'
                        >
                            <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8'>
                                <path d='M11.5 3a9 9 0 1 1-9 9' strokeLinecap='round' />
                                <polyline points='11.5 3 16 7 11.5 11' />
                            </svg>
                            <span>30</span>
                        </button>

                        {/* Volume / mute toggle */}
                        <button
                            className='sb-osd__btn'
                            onClick={handleMuteToggle}
                            aria-label='Toggle mute'
                        >
                            <svg width='20' height='20' viewBox='0 0 24 24' fill='currentColor'>
                                <path d='M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02z' />
                            </svg>
                        </button>

                        {/* Time display */}
                        <span className='sb-osd__time'>
                            <span ref={timeCurrentRef} className='sb-osd__time-current'>0:00</span>
                            <span className='sb-osd__time-sep'>/</span>
                            <span ref={timeTotalRef}>0:00</span>
                        </span>
                    </div>

                    <div className='sb-osd__controls-right'>
                        {/* Subtitle track selector */}
                        {subtitleTracks.length > 0 && (
                            <div className='sb-osd__track-selector'>
                                <button
                                    className={`sb-osd__btn${openPopover === 'subtitles' ? ' sb-osd__btn--active' : ''}`}
                                    onClick={() => setOpenPopover(prev => prev === 'subtitles' ? null : 'subtitles')}
                                    aria-label='Subtitle tracks'
                                    aria-expanded={openPopover === 'subtitles'}
                                >
                                    <svg width='18' height='18' viewBox='0 0 24 24' fill='currentColor'>
                                        <path d='M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zM4 12h4v2H4v-2zm10 4H4v-2h10v2zm6 0h-4v-2h4v2zm0-4H10v-2h10v2z' />
                                    </svg>
                                    <span>CC</span>
                                </button>
                                {openPopover === 'subtitles' && renderSubtitlePopover()}
                            </div>
                        )}

                        {/* Audio track selector — only shown when multiple tracks exist */}
                        {audioTracks.length > 1 && (
                            <div className='sb-osd__track-selector'>
                                <button
                                    className={`sb-osd__btn${openPopover === 'audio' ? ' sb-osd__btn--active' : ''}`}
                                    onClick={() => setOpenPopover(prev => prev === 'audio' ? null : 'audio')}
                                    aria-label='Audio tracks'
                                    aria-expanded={openPopover === 'audio'}
                                >
                                    <svg width='18' height='18' viewBox='0 0 24 24' fill='currentColor'>
                                        <path d='M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z' />
                                    </svg>
                                    <span>Audio</span>
                                </button>
                                {openPopover === 'audio' && renderAudioPopover()}
                            </div>
                        )}

                        {/* Fullscreen */}
                        <button
                            className='sb-osd__btn'
                            onClick={handleFullscreenToggle}
                            aria-label='Toggle fullscreen'
                        >
                            <svg width='18' height='18' viewBox='0 0 24 24' fill='currentColor'>
                                <path d='M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z' />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PlayerOSD;
