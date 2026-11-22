# Brief

Six small files compute one number. Every pricing change touches three or four of them, and the only test file checks each helper alone. A recent bug (a coupon applied after tax) passed every helper test.

Redesign this as a module that a maintainer can change in one place and a test can check through one entry point. Behavior must stay the same. The README lists the rules.
