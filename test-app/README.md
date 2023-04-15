# UIX Test App

This app can be used to test UIX components and features.
Each newly added component should be added to this test app on the backend and frontend entrypoint to demonstrate this it behaves
correctly.

The importmap uses the unyt cdn for all core libraries, but the uix library is mapped to the `uix/` common directory, which is a symlink pointing
to the local repository root.