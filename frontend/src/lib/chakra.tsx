'use client';

import React from 'react';
import { useTheme as useNextTheme } from 'next-themes';
import * as Chakra from '@chakra-ui/react';

export * from '@chakra-ui/react';

export type BoxProps = React.ComponentProps<typeof Chakra.Box>;
export type SpaceProps = React.ComponentProps<typeof Chakra.Box>;

// Keep v2-style custom variants working during migration.
export const AspectRatio = Chakra.AspectRatio as any;
export const AvatarGroup = Chakra.AvatarGroup as any;
export const Box = Chakra.Box as any;
export const BreadcrumbItem = Chakra.BreadcrumbItem as any;
export const BreadcrumbLink = Chakra.BreadcrumbLink as any;
export const Button = React.forwardRef<any, any>(
  ({ isLoading, isDisabled, loading, disabled, ...rest }, ref) => (
    <Chakra.Button
      ref={ref}
      loading={loading ?? isLoading}
      disabled={disabled ?? isDisabled}
      {...rest}
    />
  ),
);
Button.displayName = 'Button';
export const Center = Chakra.Center as any;
export const ChakraProvider = Chakra.ChakraProvider as any;
export const DrawerBody = Chakra.DrawerBody as any;
export const DrawerContent = Chakra.DrawerContent as any;
export const Flex = Chakra.Flex as any;
export const Grid = Chakra.Grid as any;
export const Heading = Chakra.Heading as any;
export const HStack = Chakra.HStack as any;
export const Icon = Chakra.Icon as any;
export const IconButton = Chakra.IconButton as any;
export const Image = Chakra.Image as any;
export const Input = Chakra.Input as any;
export const InputGroup = Chakra.chakra.div as any;
export const Link = Chakra.Link as any;
export const ListItem = Chakra.ListItem as any;
export const MenuItem = Chakra.MenuItem as any;
export const Portal = Chakra.Portal as any;
export const SimpleGrid = Chakra.SimpleGrid as any;
export const Skeleton = Chakra.Skeleton as any;
export const SkeletonText = Chakra.SkeletonText as any;
export const Spacer = Chakra.Spacer as any;
export const Stack = Chakra.Stack as any;
export const StatLabel = Chakra.StatLabel as any;
export const Text = Chakra.Text as any;
export const Textarea = Chakra.Textarea as any;
export const Badge = Chakra.Badge as any;

export const Drawer = ({
  isOpen,
  onClose,
  onOpenChange,
  children,
  ...rest
}: {
  isOpen?: boolean;
  onClose?: () => void;
  onOpenChange?: (details: { open: boolean }) => void;
  children: React.ReactNode;
  [key: string]: any;
}) => {
  const handleOpenChange = React.useCallback(
    (details: { open: boolean }) => {
      onOpenChange?.(details);
      if (!details.open) {
        onClose?.();
      }
    },
    [onClose, onOpenChange],
  );

  return (
    <Chakra.DrawerRoot open={isOpen} onOpenChange={handleOpenChange} {...rest}>
      {children}
    </Chakra.DrawerRoot>
  );
};

export const DrawerOverlay = Chakra.DrawerBackdrop;

export const DrawerCloseButton = React.forwardRef<any, any>((props, ref) => (
  <Chakra.DrawerCloseTrigger asChild>
    <Chakra.CloseButton ref={ref} {...props} />
  </Chakra.DrawerCloseTrigger>
));
DrawerCloseButton.displayName = 'DrawerCloseButton';

export const Menu = ({
  isOpen,
  onClose,
  onOpenChange,
  children,
  ...rest
}: {
  isOpen?: boolean;
  onClose?: () => void;
  onOpenChange?: (details: { open: boolean }) => void;
  children: React.ReactNode;
  [key: string]: any;
}) => {
  const handleOpenChange = React.useCallback(
    (details: { open: boolean }) => {
      onOpenChange?.(details);
      if (!details.open) {
        onClose?.();
      }
    },
    [onClose, onOpenChange],
  );

  return (
    <Chakra.MenuRoot open={isOpen} onOpenChange={handleOpenChange} {...rest}>
      {children}
    </Chakra.MenuRoot>
  );
};

export const MenuButton = React.forwardRef<any, any>((props, ref) => (
  <Chakra.MenuTrigger asChild>
    <Chakra.chakra.button type="button" ref={ref} {...props} />
  </Chakra.MenuTrigger>
));
MenuButton.displayName = 'MenuButton';

export const MenuList = React.forwardRef<any, any>((props, ref) => (
  <Chakra.MenuPositioner>
    <Chakra.MenuContent ref={ref} {...props} />
  </Chakra.MenuPositioner>
));
MenuList.displayName = 'MenuList';

export const FormControl = Chakra.chakra.div as any;
export const FormLabel = Chakra.chakra.label as any;

export const InputLeftElement = React.forwardRef<any, any>((props, ref) => (
  <Chakra.chakra.div
    ref={ref}
    position="absolute"
    left="0"
    top="0"
    height="100%"
    display="flex"
    alignItems="center"
    zIndex={1}
    {...props}
  />
));
InputLeftElement.displayName = 'InputLeftElement';

export const InputRightElement = React.forwardRef<any, any>((props, ref) => (
  <Chakra.chakra.div
    ref={ref}
    position="absolute"
    right="0"
    top="0"
    height="100%"
    display="flex"
    alignItems="center"
    zIndex={1}
    {...props}
  />
));
InputRightElement.displayName = 'InputRightElement';

export const Avatar = React.forwardRef<any, any>(({ name, src, children, ...props }, ref) => (
  <Chakra.AvatarRoot ref={ref} {...props}>
    {src ? <Chakra.AvatarImage src={src} /> : null}
    <Chakra.AvatarFallback name={name}>{children}</Chakra.AvatarFallback>
  </Chakra.AvatarRoot>
));
Avatar.displayName = 'Avatar';

export const Select = React.forwardRef<any, any>(({ children, ...props }, ref) => (
  <Chakra.NativeSelectRoot {...props}>
    <Chakra.NativeSelectField ref={ref}>{children}</Chakra.NativeSelectField>
    <Chakra.NativeSelectIndicator />
  </Chakra.NativeSelectRoot>
));
Select.displayName = 'Select';

export const Switch = React.forwardRef<any, any>(({ children, ...props }, ref) => (
  <Chakra.SwitchRoot ref={ref} {...props}>
    <Chakra.SwitchHiddenInput />
    <Chakra.SwitchControl />
    {children ? <Chakra.SwitchLabel>{children}</Chakra.SwitchLabel> : null}
  </Chakra.SwitchRoot>
));
Switch.displayName = 'Switch';

export const Checkbox = React.forwardRef<any, any>(({ children, ...props }, ref) => (
  <Chakra.CheckboxRoot ref={ref} {...props}>
    <Chakra.CheckboxHiddenInput />
    <Chakra.CheckboxControl />
    {children ? <Chakra.CheckboxLabel>{children}</Chakra.CheckboxLabel> : null}
  </Chakra.CheckboxRoot>
));
Checkbox.displayName = 'Checkbox';

export const Breadcrumb = Chakra.BreadcrumbRoot;
export const Progress = Chakra.ProgressRoot as any;
export const Stat = Chakra.StatRoot as any;
export const StatNumber = Chakra.StatValueText as any;
export const Table = Chakra.TableRoot as any;
export const Thead = Chakra.TableHeader as any;
export const Tbody = Chakra.TableBody as any;
export const Tr = Chakra.TableRow as any;
export const Th = Chakra.TableColumnHeader as any;
export const Td = Chakra.TableCell as any;
export const List = Chakra.ListRoot as any;

const useHasMounted = () => {
  const [hasMounted, setHasMounted] = React.useState(false);

  React.useEffect(() => {
    setHasMounted(true);
  }, []);

  return hasMounted;
};

export const useColorMode = () => {
  const { resolvedTheme, setTheme } = useNextTheme();
  const hasMounted = useHasMounted();
  const colorMode = hasMounted && resolvedTheme === 'dark' ? 'dark' : 'light';

  const toggleColorMode = React.useCallback(() => {
    setTheme(colorMode === 'dark' ? 'light' : 'dark');
  }, [colorMode, setTheme]);

  return {
    colorMode,
    setColorMode: setTheme,
    toggleColorMode,
  };
};

export const useDisclosure = (...args: any[]) => {
  const disclosure = (Chakra.useDisclosure as any)(...args);
  return {
    ...disclosure,
    isOpen: disclosure.isOpen ?? disclosure.open,
  };
};

export const useColorModeValue = <TLight, TDark>(light: TLight, dark: TDark) => {
  const { colorMode } = useColorMode();
  return colorMode === 'dark' ? dark : light;
};
