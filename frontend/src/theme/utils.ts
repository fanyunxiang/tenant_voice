export type StyleFunctionProps = {
  colorMode?: 'light' | 'dark';
};

export type StyleConfig = Record<string, any>;

export const mode = <T>(light: T, dark: T) => (props: StyleFunctionProps = {}) =>
  props.colorMode === 'dark' ? dark : light;

export const createBreakpoints = <T extends Record<string, string>>(breakpoints: T) => breakpoints;
