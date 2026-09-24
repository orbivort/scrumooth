/**
 * The Definition tab's in-page navigation.
 *
 * What matters here is the contract the rest of the page depends on: one anchor per section pointing at
 * the heading a deep link already names, exactly one of them marked as the current location, and the
 * count shown for a section only while that section's read has something to say.
 *
 * It is deliberately a list of links rather than a tab strip, so the tests assert what that rules out as
 * well as what it renders -- no tablist, no roving tabindex, no arrow-key handling.
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { screen, renderWithProviders, initTestI18n } from '@/test-utils';

import { SectionCountsProvider, usePublishSectionCount } from '../SectionCountsContext';
import type { DefinitionSectionId } from '../hooks/useSectionDeepLink';

import { SectionNav } from './SectionNav';

vi.mock('./SectionNav.module.css', () => ({
  default: new Proxy({}, { get: (_target, key) => String(key) }),
}));

type Counts = Partial<Record<DefinitionSectionId, number>>;

/** Stands in for the sections: each publishes the number it read, or nothing at all. */
const Publisher: React.FC<{ counts: Counts }> = ({ counts }) => {
  usePublishSectionCount('definition-of-done', counts['definition-of-done']);
  usePublishSectionCount('definition-of-ready', counts['definition-of-ready']);
  usePublishSectionCount('working-agreements', counts['working-agreements']);

  return null;
};

const Harness: React.FC<{ counts?: Counts; activeSectionId?: DefinitionSectionId }> = ({
  counts = {},
  activeSectionId = 'definition-of-done',
}) => (
  <SectionCountsProvider>
    <Publisher counts={counts} />
    <SectionNav activeSectionId={activeSectionId} />
  </SectionCountsProvider>
);

describe('SectionNav', () => {
  beforeAll(async () => {
    await initTestI18n();
  });

  it('lists one link per section, in the order the page renders them', () => {
    renderWithProviders(<Harness />);

    const links = screen.getAllByRole('link');

    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '#definition-of-done',
      '#definition-of-ready',
      '#working-agreements',
    ]);
  });

  it('uses the headings own titles, so a link cannot drift from what it points at', () => {
    renderWithProviders(<Harness />);

    expect(screen.getByRole('link', { name: /Definition of Done/ })).toHaveAttribute(
      'href',
      '#definition-of-done'
    );
    expect(screen.getByRole('link', { name: /Definition of Ready/ })).toHaveAttribute(
      'href',
      '#definition-of-ready'
    );
    expect(screen.getByRole('link', { name: /Agreements/ })).toHaveAttribute(
      'href',
      '#working-agreements'
    );
  });

  it('marks the section being read as the current location, and only that one', () => {
    renderWithProviders(<Harness activeSectionId="definition-of-ready" />);

    expect(screen.getByRole('link', { name: /Definition of Ready/ })).toHaveAttribute(
      'aria-current',
      'true'
    );
    expect(screen.getByRole('link', { name: /Definition of Done/ })).not.toHaveAttribute(
      'aria-current'
    );
    expect(screen.getByRole('link', { name: /Agreements/ })).not.toHaveAttribute('aria-current');
  });

  it('names the navigation, so it is announced as a landmark and not as a bare list', () => {
    renderWithProviders(<Harness />);

    expect(screen.getByRole('navigation', { name: 'In this agreement' })).toBeInTheDocument();
  });

  it('shows the published count beside the section name, as a pill and in the link name', () => {
    renderWithProviders(<Harness counts={{ 'definition-of-done': 5 }} />);

    // The number alone is decoration; the name is what a screen reader reads.
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Definition of Done — 5 active items' })
    ).toHaveAttribute('href', '#definition-of-done');
  });

  it('shows no count for a section whose read has not settled', () => {
    renderWithProviders(<Harness counts={{ 'definition-of-done': 5 }} />);

    const ready = screen.getByRole('link', { name: 'Definition of Ready' });

    expect(ready).toBeInTheDocument();
    expect(screen.queryByText('6')).not.toBeInTheDocument();
  });

  it('stops showing a count once its section withdraws it', () => {
    const { rerender } = renderWithProviders(<Harness counts={{ 'definition-of-done': 4 }} />);

    expect(screen.getByText('4')).toBeInTheDocument();

    rerender(<Harness counts={{}} />);

    expect(screen.queryByText('4')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Definition of Done' })).toBeInTheDocument();
  });

  // The three sections are clauses of one agreement read in order, so the navigation is real links: a
  // tablist would say they were parallel views, and roving tabindex would put arrow keys in the way of
  // the browser's own in-page navigation.
  it('is a list of links, not a tab strip', () => {
    renderWithProviders(<Harness />);

    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();

    for (const link of screen.getAllByRole('link')) {
      expect(link).not.toHaveAttribute('tabindex');
      expect(link).not.toHaveAttribute('role');
    }
  });
});
