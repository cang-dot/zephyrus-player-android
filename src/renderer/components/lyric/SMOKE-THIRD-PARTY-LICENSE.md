# Smoke background attribution

The smoke background uses a small, project-specific OGL shader implementation
based on the fluid-advection approach demonstrated by
`PavelDoGreat/WebGL-Fluid-Simulation`.

- Source: https://github.com/PavelDoGreat/WebGL-Fluid-Simulation
- Reference commit: `a2d292931f19d9b3b9f564e23e6c32729d2121c3`
- License: MIT

The application does not bundle the upstream repository. Only the required
rendering approach was adapted to the existing OGL canvas component and kept at
a fixed low resolution for Android WebView performance.

MIT permission notice:

Copyright (c) 2017 Pavel Dobryakov

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is furnished
to do so, subject to the following conditions: The above copyright notice and
this permission notice shall be included in all copies or substantial portions
of the Software.
