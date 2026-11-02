import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
export default function Link({ href, to, children, ...props }) {
  return <RouterLink to={to ?? href} {...props}>{children}</RouterLink>;
}
