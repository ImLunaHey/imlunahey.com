export type Tool = {
  /**
   * Name of the tool
   */
  name: string;
  /**
   * Icon for the tool
   */
  icon: React.ReactNode;
  /**
   * Function to call when the tool is clicked
   */
  onClick: () => void;
  /**
   * Text to display when the tool is hovered
   */
  helpText?: string;
  /*
   * Keyboard shortcut for the tool
   */
  shortcut?: string;
  /**
   * Whether the tool is active
   */
  isActive?: boolean;
  /**
   * Properties panel for the tool
   */
  properties?: () => React.ReactNode;
};
