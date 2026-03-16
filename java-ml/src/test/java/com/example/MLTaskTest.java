package com.example;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;

public class MLTaskTest {

    @Test
    void mainShouldRunWithoutThrowing() {
        assertDoesNotThrow(() -> MLTask.main(new String[0]));
    }
}
