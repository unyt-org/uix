#!/bin/zsh
# Copyright 2023 unyt.org
# Install: curl -s https://dev.cdn.unyt.org/uix/install.sh | sh


# URL of the file to be downloaded
uix_script_url="https://dev.cdn.unyt.org/uix/run.sh"

# First install deno
if ! [ -x "$(command -v deno)" ]; then
	echo 'Installing deno...'
	curl -fsSL https://deno.land/x/install/install.sh | sh

	# add deno to bashrc
	echo "export DENO_INSTALL="\$HOME/.deno"" >> ~/.bashrc
	echo "export PATH=\"\$DENO_INSTALL/bin:\$PATH\"" >> ~/.bashrc
	. ~/.bashrc
fi

name="uix"
uix_dir="$HOME/.uix"
exe="$uix_dir/$name"

if [ ! -d "$uix_dir" ]; then
    mkdir -p "$uix_dir"
fi


# Download
curl --fail --location --progress-bar -o "$exe" "$uix_script_url"
# Make executable
chmod +x "$exe"

# Add to the PATH variable
if command -v uix >/dev/null; then
	echo "export UIX_DIR="\$HOME/.uix"" >> ~/.bashrc
	echo "export PATH=\$UIX_DIR:\$PATH" >> ~/.bashrc
	# make the change effective immediately
	. ~/.bashrc
fi

echo "\n"
echo " \x1B[32m\x1B[1muix\x1B[0m\x1B[32m was installed successfully to $exe\x1B[0m"
echo "\n"
echo " Run 'uix --help' to get started"
echo " Need more help? Join the unyt.org Discord: \x1B[4mhttps://unyt.org/discord\x1B[0m"
echo "\n"