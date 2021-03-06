/**
 * @license Reactive Desktop
 * Copyright (c) Hidekazu Kubota
 *
 * This source code is licensed under the Mozilla Public License Version 2.0
 * found in the LICENSE file in the root directory of this source tree.
 */
import * as React from 'react';
import './SelectableTag.css';
import { ColorName, uiColors } from '../modules_common/color';

export interface SelectableTagProps {
  click: (value: any) => void;
  label: string;
  value: string;
  selected: boolean;
}

export const SelectableTag = (props: SelectableTagProps) => {
  const handleClick = () => {
    if (!props.selected) {
      props.click(props.value);
    }
  };

  const style = (color: ColorName) => ({
    backgroundColor: uiColors[color],
  });

  let color: ColorName = 'yellow';
  if (props.selected) {
    color = 'green';
  }

  return (
    <div
      style={style(color)}
      styleName={`tag ${props.selected ? 'selected' : ''}`}
      onClick={handleClick}
    >
      {props.label}
    </div>
  );
};
