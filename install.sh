#!/bin/sh
# Copyright 2023 unyt.org
# Install: curl -s https://cdn.unyt.org/uix/install.sh | sh

#!/bin/bash

# URL of the file to be downloaded
uix_script_url="https://cdn.unyt.org/uix/run.sh"

dest_dir="/usr/local/bin"
file_name="uix"
file_path="$dest_dir/$file_name"

# Download
curl -o "$file_path" "$uix_script_url"
# Make executable
chmod +x "$file_path"

# Add to the PATH variable
echo "export PATH=$PATH:$dest_dir" >> ~/.bashrc
# make the change effective immediately
. ~/.bashrc

echo "uix was installed successfully"