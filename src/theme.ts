import { createContext, useContext } from 'react';

export type Theme = {
  dark: boolean;
  bg: string;
  surface: string;
  ink: string;
  muted: string;
  line: string;
  /** Fill for rest days and empty heatmap cells. */
  faint: string;
  frost: string;
  frostEdge: string;
  danger: string;
  /** One colour per habit; the chrome itself stays neutral. */
  habit: string[];
};

export const light: Theme = {
  dark: false,
  bg: '#F3F5F2',
  surface: '#FFFFFF',
  ink: '#16202A',
  muted: '#566370',
  line: '#D8DDD8',
  faint: '#E4E8E3',
  frost: '#CFE4F3',
  frostEdge: '#5F93BD',
  danger: '#B3261E',
  habit: ['#2A7A4B', '#1D6BB0', '#84399A', '#BF4518', '#8F6400', '#BD2B5E'],
};

export const dark: Theme = {
  dark: true,
  bg: '#12181F',
  surface: '#1B232C',
  ink: '#EAF0F4',
  muted: '#9DAAB5',
  line: '#2E3944',
  faint: '#242E38',
  frost: '#24435C',
  frostEdge: '#8EBFE6',
  danger: '#FF8A80',
  habit: ['#5CC98A', '#6CB4F5', '#CB8FE2', '#F58A5E', '#E6BC47', '#F47FA6'],
};

export const HABIT_COLOR_NAMES = ['Moss', 'Ocean', 'Plum', 'Ember', 'Gold', 'Rose'];

export const fonts = { display: 'BricolageGrotesque_700Bold', medium: 'BricolageGrotesque_500Medium' };

export const ThemeContext = createContext<Theme>(light);
export const useTheme = () => useContext(ThemeContext);
