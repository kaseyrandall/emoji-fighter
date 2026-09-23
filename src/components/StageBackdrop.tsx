import React from 'react';

interface StageBackdropProps {
  background?: string;
  ambientLight?: string;
}

// The full-screen stage image + ambient blend layer. Memoized so it isn't
// reconciled on every 60fps movement frame (it only changes when the stage
// does), which keeps the expensive mix-blend layer off the per-frame path.
function StageBackdropBase({ background, ambientLight }: StageBackdropProps) {
  return (
    <>
      <div
        className="absolute inset-0 bg-black bg-cover bg-center"
        style={{ backgroundImage: `url(${background})` }}
      />
      <div className={`absolute inset-0 ${ambientLight} mix-blend-overlay`} />
    </>
  );
}

export const StageBackdrop = React.memo(StageBackdropBase);
