import React from 'react';
import { Composition } from 'remotion';
import { Main, TOTAL_FRAMES } from './Main';
import { LongContextExplainer, LONG_CONTEXT_FRAMES } from './LongContextExplainer';

export const Root: React.FC = () => (
  <>
    <Composition
      id="ZephyrusHorizontal"
      component={Main}
      durationInFrames={TOTAL_FRAMES}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{}}
    />
    <Composition
      id="LongContextExplainer"
      component={LongContextExplainer}
      durationInFrames={LONG_CONTEXT_FRAMES}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{}}
    />
  </>
);
