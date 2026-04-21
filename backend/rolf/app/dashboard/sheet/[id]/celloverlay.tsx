"use client";

interface LockInfo {
    userId: string;
    username: string;
    color: string;
}

interface Props {
    locks: Record<string, LockInfo>;
    currentUserId: string;
}

export default function CellLockOverlay({ locks, currentUserId }: Props) {
    const otherLocks = Object.entries(locks).filter(
        ([, lock]) => lock.userId !== currentUserId
    );

    if (otherLocks.length === 0) return null;

    return (
        <div style={{
            position: "absolute",
            top: 0, left: 0, right: 0, bottom: 0,
            pointerEvents: "none",
            zIndex: 100,
        }}>
            {otherLocks.map(([cellRef, lock]) => (
                <div
                    key={cellRef}
                    data-cell-ref={cellRef}
                    style={{
                        position: "absolute",
                        background: `${lock.color}22`,
                        border: `2px solid ${lock.color}`,
                        borderRadius: "2px",
                        pointerEvents: "none",
                    }}
                >
                    <span style={{
                        position: "absolute",
                        top: "-20px",
                        left: 0,
                        background: lock.color,
                        color: "white",
                        fontSize: "11px",
                        padding: "1px 6px",
                        borderRadius: "3px",
                        whiteSpace: "nowrap",
                        fontWeight: 600,
                    }}>
                        {lock.username}
                    </span>
                </div>
            ))}
        </div>
    );
}