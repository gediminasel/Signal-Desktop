// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

type Props = {
  label: string;
};

export function EmptyState({
  label,
  children,
}: React.PropsWithChildren<Props>): JSX.Element {
  return (
    <div className="module-empty-state">
      {label}
      {children || null}
    </div>
  );
}
