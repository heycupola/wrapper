# Build script for wrapper-pty-helper.
#
#   make           — build for the current host into ../../apps/cli/bin/
#   make all       — cross-compile every supported triple via `zig cc`
#   make clean     — remove every produced binary
#
# We commit the produced binaries so end users never need a C
# toolchain. Zig is required only for cross-compiles (`make all`).

OUT_DIR    := ../../apps/cli/bin
SRC        := pty-helper.c
NAME       := wrapper-pty-helper

.PHONY: default
default: $(OUT_DIR)/$(NAME)

$(OUT_DIR)/$(NAME): $(SRC)
	@mkdir -p $(OUT_DIR)
	$(CC) -O2 -Wall -Wextra -o $@ $<
	@echo "built: $@"

TRIPLES := aarch64-macos-none x86_64-macos-none aarch64-linux-musl x86_64-linux-musl

.PHONY: all
all: $(addprefix $(OUT_DIR)/$(NAME)-,$(TRIPLES))

$(OUT_DIR)/$(NAME)-%: $(SRC)
	@mkdir -p $(OUT_DIR)
	zig cc -target $* -O2 -o $@ $<
	@echo "built: $@"

.PHONY: clean
clean:
	rm -f $(OUT_DIR)/$(NAME) $(OUT_DIR)/$(NAME)-*
