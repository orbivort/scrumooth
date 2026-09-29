/**
 * The panel a route guard renders in place of a page the reader's role may not reach.
 *
 * A refusal is only useful if it does three things: says the page was refused rather than broken,
 * names whose page it is, and leaves the reader somewhere they can act. The coverage below is those
 * three, plus the two properties that make the panel usable without a mouse -- it announces itself,
 * and its way onward is a real link with a real address.
 */
import React from 'react';
import { MemoryRouter } from 'react-router';
import { render, screen, initTestI18n, i18nT } from '../../../test-utils';
import { beforeAll, describe, expect, it } from 'vitest';

import { AccessDenied } from './AccessDenied';

const renderPanel = () =>
  render(
    <MemoryRouter>
      <AccessDenied />
    </MemoryRouter>
  );

describe('AccessDenied', () => {
  beforeAll(async () => {
    await initTestI18n();
  });

  it('should say the page was refused and whose page it is', () => {
    renderPanel();

    expect(
      screen.getByRole('heading', { name: i18nT('common:accessDenied.title') })
    ).toBeInTheDocument();
    expect(screen.getByText(i18nT('common:accessDenied.description'))).toBeInTheDocument();
  });

  it('should announce the reason rather than appear silently', () => {
    renderPanel();

    // The reader reached this by address, so no control was activated and nothing else would tell
    // them why the page they asked for is not the page they got.
    expect(screen.getByRole('status')).toHaveTextContent(i18nT('common:accessDenied.description'));
  });

  it('should leave the reader a destination they can reach', () => {
    renderPanel();

    const onward = screen.getByRole('link', { name: i18nT('common:accessDenied.action') });
    expect(onward).toHaveAttribute('href', '/team');
  });

  it('should name the region by its heading', () => {
    const { container } = renderPanel();

    const region = container.querySelector('section');
    expect(region).toHaveAttribute('aria-labelledby', 'access-denied-title');
    expect(container.querySelector('#access-denied-title')).toHaveTextContent(
      i18nT('common:accessDenied.title')
    );
  });
});
