// Team groups and their shared Definition of Done.
//
// The 2020 Scrum Guide: *"If there are multiple Scrum Teams working together on a product, they
// must mutually define and comply with the same Definition of Done."* A group is that rule made
// structural: the group owns one Definition of Done, every team in it reads that one, and joining
// records the version the team adopted.
//
// A group is a product-collaboration device, not a team decomposition -- nothing inside a Scrum
// Team changes, so *"no sub-teams or hierarchies"* is not infringed.

/**
 * A group as a team browses it before joining: enough to choose one and to see which Definition of
 * Done version would be adopted.
 */
export interface TeamGroupSummary {
  id: string;
  name: string;
  description: string | null;
  /** How many Scrum Teams work on this product. */
  teamCount: number;
  /** The version of the shared Definition of Done currently in force. */
  dodVersion: number;
}

/** One team's membership of a group, as the group's own surfaces report it. */
export interface TeamGroupMember {
  id: string;
  name: string;
  /** When the team joined, or null on a record predating the adoption record. */
  joinedAt: string | null;
  /** The shared Definition of Done version the team adopted when it joined. */
  adoptedDodVersion: number | null;
}

/** One criterion of a shared Definition of Done. */
export interface SharedDoDItem {
  id: string;
  description: string;
  category: string | null;
  isActive: boolean;
  order: number;
}

/**
 * A group's shared Definition of Done.
 *
 * Readable before joining as well as after: a team cannot "mutually define" a commitment it is not
 * allowed to read, so the version and its items are the join preview.
 */
export interface SharedDefinitionOfDone {
  groupId: string;
  version: number;
  items: SharedDoDItem[];
  updatedAt: string;
}

/** A group with its teams and the Definition of Done they comply with. */
export interface TeamGroupDetail extends TeamGroupSummary {
  teams: TeamGroupMember[];
  definitionOfDone: SharedDefinitionOfDone;
}

/** The payload that records a team's adoption of a group's shared Definition of Done. */
export interface JoinTeamGroupInput {
  groupId: string;
  /**
   * The version of the shared Definition of Done the team is adopting. Refused when it is not the
   * version in force, so a team cannot adopt a Definition of Done it never saw.
   */
  acknowledgedDodVersion?: number;
}

/** The writable half of a group: what it is called and what it is for. */
export interface UpdateTeamGroupInput {
  name?: string;
  description?: string | null;
}

/** The writable half of the shared Definition of Done. */
export interface UpdateSharedDoDInput {
  items: Array<{
    id?: string;
    description: string;
    category?: string;
    isActive: boolean;
    order: number;
  }>;
}
