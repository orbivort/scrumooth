// Escalate a team impediment into an organizational barrier.
//
// This is the "act" the Scrum Master dashboard used to lack: it could see an impediment aging and
// do nothing about it. The dialog prefills the barrier from the impediment, links the two records,
// and refuses a second escalation of the same impediment (the server refuses it too, with a gate
// code, so a stale page cannot record the same problem twice).
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BARRIER_PRIORITIES,
  type BarrierPriority,
  type ImpedimentPriority,
} from '@scrumooth/shared';

import { Button } from '../common/Button';
import { useTeamStore } from '../../store';
import { organizationalBarriersService } from '../../services';

import styles from './EscalateImpedimentDialog.module.css';

export interface EscalationSource {
  id: string;
  title: string;
  description?: string | null;
  priority?: ImpedimentPriority;
  alreadyEscalatedTo?: string | null;
}

const PRIORITY_LABEL_KEYS = {
  CRITICAL: 'priority.critical',
  HIGH: 'priority.high',
  MEDIUM: 'priority.medium',
  LOW: 'priority.low',
} as const satisfies Record<BarrierPriority, string>;

interface EscalateImpedimentDialogProps {
  open: boolean;
  source: EscalationSource | null;
  onClose: () => void;
  onEscalated?: () => void;
}

export const EscalateImpedimentDialog: React.FC<EscalateImpedimentDialogProps> = ({
  open,
  source,
  onClose,
  onEscalated,
}) => {
  const { t } = useTranslation(['barriers', 'common']);
  const { currentTeam } = useTeamStore();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<BarrierPriority>('MEDIUM');
  const [ownerId, setOwnerId] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && source) {
      setTitle(source.title);
      setDescription(source.description ?? '');
      setPriority((source.priority as BarrierPriority | undefined) ?? 'MEDIUM');
      setOwnerId('');
      setTargetDate('');
      setError(null);
    }
  }, [open, source]);

  const members = (currentTeam?.members ?? []).map((member) => ({
    userId: member.userId,
    name: member.user ? `${member.user.firstName} ${member.user.lastName}`.trim() : member.userId,
  }));

  const handleSubmit = useCallback(async () => {
    if (!source || !currentTeam?.id) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await organizationalBarriersService.escalateImpediment({
        teamId: currentTeam.id,
        impedimentId: source.id,
        title: title.trim() || undefined,
        description: description.trim() || undefined,
        priority,
        ownerId: ownerId || null,
        targetDate: targetDate || null,
      });
      onEscalated?.();
      onClose();
    } catch (caught) {
      // The server's refusal is already localized and carries the gate code -- for a second
      // escalation it names the barrier that already exists -- so it is shown as it stands rather
      // than flattened into "something went wrong".
      const refusal = caught as { response?: { data?: { error?: { message?: string } } } };
      const message = refusal.response?.data?.error?.message ?? t('escalate.error');

      setError(message);
    } finally {
      setSubmitting(false);
    }
  }, [
    currentTeam?.id,
    description,
    onClose,
    onEscalated,
    ownerId,
    priority,
    source,
    t,
    targetDate,
    title,
  ]);

  if (!open || !source) {
    return null;
  }

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label={t('escalate.title')}
    >
      <form
        className={styles.dialog}
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit();
        }}
      >
        <h2 className={styles.title}>{t('escalate.title')}</h2>
        <p className={styles.intro}>{t('escalate.intro')}</p>

        <p className={styles.source}>
          {t('escalate.impediment')}: <strong>{source.title}</strong>
        </p>

        {source.alreadyEscalatedTo && (
          <p className={styles.error} role="alert">
            {t('escalate.alreadyEscalated', { title: source.alreadyEscalatedTo })}
          </p>
        )}

        <label className={styles.field}>
          <span className={styles.label}>{t('escalate.titleLabel')}</span>
          <input
            className={styles.input}
            type="text"
            value={title}
            maxLength={200}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>{t('escalate.descriptionLabel')}</span>
          <textarea
            className={styles.textarea}
            value={description}
            rows={3}
            maxLength={4000}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>

        <div className={styles.row}>
          <label className={styles.field}>
            <span className={styles.label}>{t('escalate.priority')}</span>
            <select
              className={styles.select}
              value={priority}
              onChange={(event) => setPriority(event.target.value as BarrierPriority)}
            >
              {BARRIER_PRIORITIES.map((option) => (
                <option key={option} value={option}>
                  {t(PRIORITY_LABEL_KEYS[option])}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span className={styles.label}>{t('escalate.owner')}</span>
            <select
              className={styles.select}
              value={ownerId}
              onChange={(event) => setOwnerId(event.target.value)}
            >
              <option value="">{t('list.unassigned')}</option>
              {members.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.name}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span className={styles.label}>{t('escalate.targetDate')}</span>
            <input
              className={styles.input}
              type="date"
              value={targetDate}
              onChange={(event) => setTargetDate(event.target.value)}
            />
          </label>
        </div>

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <div className={styles.actions}>
          <Button variant="link" onClick={onClose} disabled={submitting}>
            {t('escalate.cancel')}
          </Button>
          <Button type="submit" loading={submitting} disabled={!!source.alreadyEscalatedTo}>
            {t('escalate.confirm')}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default EscalateImpedimentDialog;
