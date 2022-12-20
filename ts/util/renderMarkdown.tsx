// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactElement } from 'react';
import React from 'react';
import type { RenderTextCallbackType } from '../types/Util';

const markdown: {
  [symbol: string]: (t: JSX.Element, key: number) => JSX.Element;
} = {
  '**': (t, key) => <b key={key}>{t}</b>,
  __: (t, key) => <u key={key}>{t}</u>,
  '//': (t, key) => <i key={key}>{t}</i>,
  '`': (t, key) => (
    <code style={{ fontWeight: 'bold' }} key={key}>
      {t}
    </code>
  ),
  '~~': (t, key) => (
    <span style={{ textDecorationLine: 'line-through' }} key={key}>
      {t}
    </span>
  ),
};

export type RenderMarkdownArgs = {
  text: string;
  depth?: number;
  key?: number;
};

export function renderMarkdownFactory(
  renderChild: RenderTextCallbackType
): RenderTextCallbackType {
  function renderMarkdownMy({
    text,
    depth,
    key,
  }: RenderMarkdownArgs): ReactElement {
    let myText = text;
    let myDepth = depth || 6;
    myDepth -= 1;
    const res = [];
    if (depth == null && text.startsWith('-- ')) {
      res.push(
        <span key="circ" style={{ fontSize: '0.5em', verticalAlign: 'middle' }}>
          &#9679;&nbsp;&nbsp;
        </span>
      );
      myText = text.substring(3);
    }
    let childKey = 0;
    while (myText.length > 0) {
      let nextSymbol = null;

      if (myDepth > 0) {
        let nextIndex = 0;
        for (const symbol of Object.keys(markdown)) {
          const index = myText.indexOf(symbol);
          if (index === -1) {
            continue;
          }
          if (nextSymbol == null || index < nextIndex) {
            nextSymbol = symbol;
            nextIndex = index;
          }
        }
      }

      if (nextSymbol == null) {
        break;
      }

      const result = myText.split(nextSymbol, 3);
      childKey += 1;
      res.push(
        renderMarkdownMy({
          text: result[0],
          key: childKey,
          depth: myDepth,
        })
      );

      if (result.length === 3) {
        myText = myText.substring(
          result[0].length + result[1].length + 2 * nextSymbol.length
        );
        if (result[1].length === 0) {
          res.push(nextSymbol.repeat(2));
        } else {
          const f = markdown[nextSymbol];
          childKey += 1;
          res.push(
            f(renderMarkdownMy({ text: result[1], depth: myDepth }), childKey)
          );
        }
      } else {
        res.push(nextSymbol);
        myText = myText.substring(result[0].length + nextSymbol.length);
      }
    }

    if (myText.length > 0) {
      childKey += 1;
      res.push(renderChild({ text: myText, key: childKey }));
    }

    return <React.Fragment key={key}>{res}</React.Fragment>;
  }
  return renderMarkdownMy;
}
