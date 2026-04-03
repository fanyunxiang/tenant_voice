// Chakra imports
import { Box, useDisclosure } from '@chakra-ui/react'
import Footer from 'components/footer/FooterAdmin'
// Layout components
import Navbar from 'components/navbar/NavbarAdmin'
import Sidebar from 'components/sidebar/Sidebar'
import { SidebarContext } from 'contexts/SidebarContext'
import { PropsWithChildren, useEffect, useState } from 'react'
import routes from 'routes'
import {
  isWindowAvailable
} from 'utils/navigation'
import { usePathname } from 'next/navigation'

interface DashboardLayoutProps extends PropsWithChildren {
  [x: string]: any
}

// Custom Chakra theme
export default function AdminLayout (props: DashboardLayoutProps) {
  const { children, ...rest } = props
  // states and functions
  const [fixed] = useState(false)
  const [toggleSidebar, setToggleSidebar] = useState(false)
  // functions for changing the states from components
  const { onOpen } = useDisclosure()
  const pathname = usePathname()

  const currentRoute = routes.find(route =>
    pathname?.startsWith(route.layout + route.path)
  )

  useEffect(() => {
    window.document.documentElement.dir = 'ltr'
  })

  return (
    <Box>
      <SidebarContext.Provider
        value={{
          toggleSidebar,
          setToggleSidebar
        }}
      >
        <Sidebar routes={routes} display='none' {...rest} />
        <Box
          float='right'
          minHeight='100vh'
          height='100%'
          overflow='auto'
          position='relative'
          maxHeight='100%'
          w={{ base: '100%', xl: 'calc( 100% - 290px )' }}
          maxWidth={{ base: '100%', xl: 'calc( 100% - 290px )' }}
          transition='all 0.33s cubic-bezier(0.685, 0.0473, 0.346, 1)'
          transitionDuration='.2s, .2s, .35s'
          transitionProperty='top, bottom, width'
          transitionTimingFunction='linear, linear, ease'
        >
          <Box>
            <Navbar
              onOpen={onOpen}
              logoText={'TenantVoice Dashboard PRO'}
              brandText={currentRoute?.name || 'Default Brand Text'}
              secondary={currentRoute?.secondary}
              message={currentRoute?.name || false}
              fixed={fixed}
              {...rest}
            />
          </Box>

          <Box
            mx='auto'
            p={{ base: '20px', md: '30px' }}
            pe='20px'
            minH='100vh'
            pt='50px'
          >
            {children}
          </Box>
          <Box>
            <Footer />
          </Box>
        </Box>
      </SidebarContext.Provider>
    </Box>
  )
}
