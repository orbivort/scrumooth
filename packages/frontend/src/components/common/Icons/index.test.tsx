import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';

import { AddIcon } from './AddIcon';
import { AlertCircleIcon } from './AlertCircleIcon';
import { AlertIcon } from './AlertIcon';
import { AlertTriangleIcon } from './AlertTriangleIcon';
import { ArchiveIcon } from './ArchiveIcon';
import { ArrowDownIcon } from './ArrowDownIcon';
import { ArrowLeftIcon } from './ArrowLeftIcon';
import { ArrowRightIcon } from './ArrowRightIcon';
import { ArrowUpIcon } from './ArrowUpIcon';
import { BellIcon } from './BellIcon';
import { BellRingIcon } from './BellRingIcon';
import { BoxIcon } from './BoxIcon';
import { BriefcaseIcon } from './BriefcaseIcon';
import { BuildingIcon } from './BuildingIcon';
import { CalendarIcon } from './CalendarIcon';
import { CalendarRangeIcon } from './CalendarRangeIcon';
import { ChartIcon } from './ChartIcon';
import { CheckCircleIcon } from './CheckCircleIcon';
import { CheckIcon } from './CheckIcon';
import { CheckmarkIcon } from './CheckmarkIcon';
import { CheckSquareIcon } from './CheckSquareIcon';
import { ChevronDownIcon } from './ChevronDownIcon';
import { ChevronLeftIcon } from './ChevronLeftIcon';
import { ChevronRightIcon } from './ChevronRightIcon';
import { ChevronUpIcon } from './ChevronUpIcon';
import { CircleIcon } from './CircleIcon';
import { ClipboardIcon } from './ClipboardIcon';
import { ClipboardListIcon } from './ClipboardListIcon';
import { ClockIcon } from './ClockIcon';
import { CloseIcon } from './CloseIcon';
import { CodeIcon } from './CodeIcon';
import { CookieIcon } from './CookieIcon';
import { CopyIcon } from './CopyIcon';
import { CrownIcon } from './CrownIcon';
import { DashboardIcon } from './DashboardIcon';
import { DatabaseIcon } from './DatabaseIcon';
import { DollarSignIcon } from './DollarSignIcon';
import { DownloadIcon } from './DownloadIcon';
import { EditIcon } from './EditIcon';
import { ErrorIcon } from './ErrorIcon';
import { EyeIcon } from './EyeIcon';
import { EyeOffIcon } from './EyeOffIcon';
import { FileCheckIcon } from './FileCheckIcon';
import { FileTextIcon } from './FileTextIcon';
import { FilterIcon } from './FilterIcon';
import { FlagIcon } from './FlagIcon';
import { FolderIcon } from './FolderIcon';
import { GoalIcon } from './GoalIcon';
import { GridViewIcon } from './GridViewIcon';
import { HelpCircleIcon } from './HelpCircleIcon';
import { HomeIcon } from './HomeIcon';
import { HourglassIcon } from './HourglassIcon';
import { ImpedimentIcon } from './ImpedimentIcon';
import { IndicatorDotIcon } from './IndicatorDotIcon';
import { InfoIcon } from './InfoIcon';
import { InboxIcon } from './InboxIcon';
import { LightbulbIcon } from './LightbulbIcon';
import { ListIcon } from './ListIcon';
import { ListViewIcon } from './ListViewIcon';
import { LoaderIcon } from './LoaderIcon';
import { LockIcon } from './LockIcon';
import { LogOutIcon } from './LogOutIcon';
import { MailIcon } from './MailIcon';
import { MenuIcon } from './MenuIcon';
import { MessageCircleIcon } from './MessageCircleIcon';
import { MessageSquareIcon } from './MessageSquareIcon';
import { MinusIcon } from './MinusIcon';
import { ModifyIcon } from './ModifyIcon';
import { MoreHorizontalIcon } from './MoreHorizontalIcon';
import { PackageIcon } from './PackageIcon';
import { PathIcon } from './PathIcon';
import { PlayIcon } from './PlayIcon';
import { PlugIcon } from './PlugIcon';
import { PlusIcon } from './PlusIcon';
import { PrivacyIcon } from './PrivacyIcon';
import { RefreshCwIcon } from './RefreshCwIcon';
import { RefreshIcon } from './RefreshIcon';
import { RemoveIcon } from './RemoveIcon';
import { ReorderIcon } from './ReorderIcon';
import { ReportsIcon } from './ReportsIcon';
import { RocketIcon } from './RocketIcon';
import { RunnerIcon } from './RunnerIcon';
import { RunningIcon } from './RunningIcon';
import { SaveIcon } from './SaveIcon';
import { ScissorsIcon } from './ScissorsIcon';
import { ScrumoothIcon } from './ScrumoothIcon';
import { SearchIcon } from './SearchIcon';
import { SearchXIcon } from './SearchXIcon';
import { SendIcon } from './SendIcon';
import { SettingsIcon } from './SettingsIcon';
import { ShieldIcon } from './ShieldIcon';
import { SmileIcon } from './SmileIcon';
import { SortIcon } from './SortIcon';
import { SparklesIcon } from './SparklesIcon';
import { SprintIcon } from './SprintIcon';
import { SquareIcon } from './SquareIcon';
import { StarIcon } from './StarIcon';
import { StoryPointsIcon } from './StoryPointsIcon';
import { SunIcon } from './SunIcon';
import { TagIcon } from './TagIcon';
import { TargetIcon } from './TargetIcon';
import { TeamIcon } from './TeamIcon';
import { TermsIcon } from './TermsIcon';
import { ThumbsDownIcon } from './ThumbsDownIcon';
import { ThumbsUpIcon } from './ThumbsUpIcon';
import { TrashIcon } from './TrashIcon';
import { TrendingDownIcon } from './TrendingDownIcon';
import { TrendingUpIcon } from './TrendingUpIcon';
import { UserEditIcon } from './UserEditIcon';
import { UserIcon } from './UserIcon';
import { UserPlusIcon } from './UserPlusIcon';
import { UsersIcon } from './UsersIcon';
import { UserXIcon } from './UserXIcon';
import { WarningIcon } from './WarningIcon';
import { XCircleIcon } from './XCircleIcon';
import { XIcon } from './XIcon';
import { ZapIcon } from './ZapIcon';
import { isIconName, iconNames } from './types';

describe('Icons', () => {
  const iconTests = [
    { name: 'AddIcon', Icon: AddIcon },
    { name: 'AlertCircleIcon', Icon: AlertCircleIcon },
    { name: 'AlertIcon', Icon: AlertIcon },
    { name: 'AlertTriangleIcon', Icon: AlertTriangleIcon },
    { name: 'ArchiveIcon', Icon: ArchiveIcon },
    { name: 'ArrowDownIcon', Icon: ArrowDownIcon },
    { name: 'ArrowLeftIcon', Icon: ArrowLeftIcon },
    { name: 'ArrowRightIcon', Icon: ArrowRightIcon },
    { name: 'ArrowUpIcon', Icon: ArrowUpIcon },
    { name: 'BellIcon', Icon: BellIcon },
    { name: 'BellRingIcon', Icon: BellRingIcon },
    { name: 'BoxIcon', Icon: BoxIcon },
    { name: 'BriefcaseIcon', Icon: BriefcaseIcon },
    { name: 'BuildingIcon', Icon: BuildingIcon },
    { name: 'CalendarIcon', Icon: CalendarIcon },
    { name: 'CalendarRangeIcon', Icon: CalendarRangeIcon },
    { name: 'ChartIcon', Icon: ChartIcon },
    { name: 'CheckCircleIcon', Icon: CheckCircleIcon },
    { name: 'CheckIcon', Icon: CheckIcon },
    { name: 'CheckmarkIcon', Icon: CheckmarkIcon },
    { name: 'CheckSquareIcon', Icon: CheckSquareIcon },
    { name: 'ChevronDownIcon', Icon: ChevronDownIcon },
    { name: 'ChevronLeftIcon', Icon: ChevronLeftIcon },
    { name: 'ChevronRightIcon', Icon: ChevronRightIcon },
    { name: 'ChevronUpIcon', Icon: ChevronUpIcon },
    { name: 'CircleIcon', Icon: CircleIcon },
    { name: 'ClipboardIcon', Icon: ClipboardIcon },
    { name: 'ClipboardListIcon', Icon: ClipboardListIcon },
    { name: 'ClockIcon', Icon: ClockIcon },
    { name: 'CloseIcon', Icon: CloseIcon },
    { name: 'CodeIcon', Icon: CodeIcon },
    { name: 'CookieIcon', Icon: CookieIcon },
    { name: 'CopyIcon', Icon: CopyIcon },
    { name: 'CrownIcon', Icon: CrownIcon },
    { name: 'DashboardIcon', Icon: DashboardIcon },
    { name: 'DatabaseIcon', Icon: DatabaseIcon },
    { name: 'DollarSignIcon', Icon: DollarSignIcon },
    { name: 'DownloadIcon', Icon: DownloadIcon },
    { name: 'EditIcon', Icon: EditIcon },
    { name: 'ErrorIcon', Icon: ErrorIcon },
    { name: 'EyeIcon', Icon: EyeIcon },
    { name: 'EyeOffIcon', Icon: EyeOffIcon },
    { name: 'FileCheckIcon', Icon: FileCheckIcon },
    { name: 'FileTextIcon', Icon: FileTextIcon },
    { name: 'FilterIcon', Icon: FilterIcon },
    { name: 'FlagIcon', Icon: FlagIcon },
    { name: 'FolderIcon', Icon: FolderIcon },
    { name: 'GoalIcon', Icon: GoalIcon },
    { name: 'GridViewIcon', Icon: GridViewIcon },
    { name: 'HelpCircleIcon', Icon: HelpCircleIcon },
    { name: 'HomeIcon', Icon: HomeIcon },
    { name: 'HourglassIcon', Icon: HourglassIcon },
    { name: 'ImpedimentIcon', Icon: ImpedimentIcon },
    { name: 'IndicatorDotIcon', Icon: IndicatorDotIcon },
    { name: 'InfoIcon', Icon: InfoIcon },
    { name: 'InboxIcon', Icon: InboxIcon },
    { name: 'LightbulbIcon', Icon: LightbulbIcon },
    { name: 'ListIcon', Icon: ListIcon },
    { name: 'ListViewIcon', Icon: ListViewIcon },
    { name: 'LoaderIcon', Icon: LoaderIcon },
    { name: 'LockIcon', Icon: LockIcon },
    { name: 'LogOutIcon', Icon: LogOutIcon },
    { name: 'MailIcon', Icon: MailIcon },
    { name: 'MenuIcon', Icon: MenuIcon },
    { name: 'MessageCircleIcon', Icon: MessageCircleIcon },
    { name: 'MessageSquareIcon', Icon: MessageSquareIcon },
    { name: 'MinusIcon', Icon: MinusIcon },
    { name: 'ModifyIcon', Icon: ModifyIcon },
    { name: 'MoreHorizontalIcon', Icon: MoreHorizontalIcon },
    { name: 'PackageIcon', Icon: PackageIcon },
    { name: 'PathIcon', Icon: PathIcon },
    { name: 'PlayIcon', Icon: PlayIcon },
    { name: 'PlugIcon', Icon: PlugIcon },
    { name: 'PlusIcon', Icon: PlusIcon },
    { name: 'PrivacyIcon', Icon: PrivacyIcon },
    { name: 'RefreshCwIcon', Icon: RefreshCwIcon },
    { name: 'RefreshIcon', Icon: RefreshIcon },
    { name: 'RemoveIcon', Icon: RemoveIcon },
    { name: 'ReorderIcon', Icon: ReorderIcon },
    { name: 'ReportsIcon', Icon: ReportsIcon },
    { name: 'RocketIcon', Icon: RocketIcon },
    { name: 'RunnerIcon', Icon: RunnerIcon },
    { name: 'RunningIcon', Icon: RunningIcon },
    { name: 'SaveIcon', Icon: SaveIcon },
    { name: 'ScissorsIcon', Icon: ScissorsIcon },
    { name: 'ScrumoothIcon', Icon: ScrumoothIcon },
    { name: 'SearchIcon', Icon: SearchIcon },
    { name: 'SearchXIcon', Icon: SearchXIcon },
    { name: 'SendIcon', Icon: SendIcon },
    { name: 'SettingsIcon', Icon: SettingsIcon },
    { name: 'ShieldIcon', Icon: ShieldIcon },
    { name: 'SmileIcon', Icon: SmileIcon },
    { name: 'SortIcon', Icon: SortIcon },
    { name: 'SparklesIcon', Icon: SparklesIcon },
    { name: 'SprintIcon', Icon: SprintIcon },
    { name: 'SquareIcon', Icon: SquareIcon },
    { name: 'StarIcon', Icon: StarIcon },
    { name: 'StoryPointsIcon', Icon: StoryPointsIcon },
    { name: 'SunIcon', Icon: SunIcon },
    { name: 'TagIcon', Icon: TagIcon },
    { name: 'TargetIcon', Icon: TargetIcon },
    { name: 'TeamIcon', Icon: TeamIcon },
    { name: 'TermsIcon', Icon: TermsIcon },
    { name: 'ThumbsDownIcon', Icon: ThumbsDownIcon },
    { name: 'ThumbsUpIcon', Icon: ThumbsUpIcon },
    { name: 'TrashIcon', Icon: TrashIcon },
    { name: 'TrendingDownIcon', Icon: TrendingDownIcon },
    { name: 'TrendingUpIcon', Icon: TrendingUpIcon },
    { name: 'UserEditIcon', Icon: UserEditIcon },
    { name: 'UserIcon', Icon: UserIcon },
    { name: 'UserPlusIcon', Icon: UserPlusIcon },
    { name: 'UsersIcon', Icon: UsersIcon },
    { name: 'UserXIcon', Icon: UserXIcon },
    { name: 'WarningIcon', Icon: WarningIcon },
    { name: 'XCircleIcon', Icon: XCircleIcon },
    { name: 'XIcon', Icon: XIcon },
    { name: 'ZapIcon', Icon: ZapIcon },
  ];

  iconTests.forEach(({ name, Icon }) => {
    describe(name, () => {
      it('should render with default props', () => {
        const { container } = render(<Icon />);
        const svg = container.querySelector('svg');
        expect(svg).toBeDefined();
        expect(svg?.getAttribute('width')).toBeDefined();
        expect(svg?.getAttribute('height')).toBeDefined();
      });

      it('should render with custom size', () => {
        const { container } = render(<Icon size={32} />);
        const svg = container.querySelector('svg');
        expect(svg?.getAttribute('width')).toBe('32');
        expect(svg?.getAttribute('height')).toBe('32');
      });

      it('should render with className', () => {
        const { container } = render(<Icon className="custom-class" />);
        const svg = container.querySelector('svg');
        expect(svg?.classList.contains('custom-class')).toBe(true);
      });

      it('should render svg element', () => {
        const { container } = render(<Icon />);
        const svg = container.querySelector('svg');
        expect(svg?.tagName.toLowerCase()).toBe('svg');
      });
    });
  });
});

describe('isIconName type guard', () => {
  it('returns true for known icon names', () => {
    expect(isIconName('AddIcon')).toBe(true);
    expect(isIconName('ScrumoothIcon')).toBe(true);
    expect(isIconName(iconNames[0])).toBe(true);
    expect(isIconName(iconNames[iconNames.length - 1])).toBe(true);
  });

  it('returns false for unknown icon names', () => {
    expect(isIconName('NotARealIcon')).toBe(false);
    expect(isIconName('')).toBe(false);
    expect(isIconName('addicon')).toBe(false);
  });
});
