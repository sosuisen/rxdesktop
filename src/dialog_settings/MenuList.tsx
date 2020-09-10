/**
 * @license Reactive Desktop
 * Copyright (c) Hidekazu Kubota
 *
 * This source code is licensed under the Mozilla Public License Version 2.0
 * found in the LICENSE file in the root directory of this source tree.
 */
import * as React from 'react';
import { MenuItem, MenuItemProps } from './MenuItem';
import './MenuList.css';

export interface MenuListProps {
  items: MenuItemProps[];
}

export const MenuList = (props: MenuListProps) => {
  return (
    <div styleName='menuList'>
      {props.items.map((item, index) => (
        <MenuItem
          key={item.id}
          id={item.id}
          label={item.label}
          icon={item.icon}
          color={item.color}
          index={index}
          width={item.width}
          height={item.height}
        />
      ))}
    </div>
  );
};
