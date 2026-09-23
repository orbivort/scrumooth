-- A Sprint Backlog change declared as endangering the Sprint Goal is recorded as PENDING and
-- needs the Product Owner's acknowledgement. The Product Owner is notified so the gate is
-- something they are told about, rather than something they have to go looking for.
ALTER TYPE "NotificationType" ADD VALUE 'SPRINT_BACKLOG_CHANGE_PENDING';
