<?php

use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\DepartmentController;
use App\Http\Controllers\Api\V1\EmployeeController;
use App\Http\Controllers\Api\V1\EmploymentTypeController;
use App\Http\Controllers\Api\V1\MasterLookupController;
use App\Http\Controllers\Api\V1\TaskAssignmentController;
use App\Http\Controllers\Api\V1\TaskController;
use App\Http\Controllers\Api\V1\TrainingController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    // Public Auth routes
    Route::post('/auth/register', [AuthController::class, 'register']);
    Route::post('/auth/login', [AuthController::class, 'login']);

    // Protected routes
    Route::middleware('auth:sanctum')->group(function () {
        Route::get('/auth/me', [AuthController::class, 'me']);
        Route::delete('/auth/logout', [AuthController::class, 'logout']);

        // Read access for Admin & Manager
        Route::middleware('role:admin,manager')->group(function () {
            Route::get('/employees', [EmployeeController::class, 'index']);
            Route::get('/employees/{employee}', [EmployeeController::class, 'show']);
            Route::get('/employment-types', [EmploymentTypeController::class, 'index']);
            Route::get('/employment-types/{employmentType}', [EmploymentTypeController::class, 'show']);
            Route::get('/departments', [DepartmentController::class, 'index']);
            Route::get('/departments/{department}', [DepartmentController::class, 'show']);
            Route::get('/positions', [MasterLookupController::class, 'positions']);
        });

        // Write access strictly for Admin (PBI-01: FR-02 & FR-05, PBI-02: FR-03)
        Route::middleware('role:admin')->group(function () {
            Route::post('/employees', [EmployeeController::class, 'store']);
            Route::put('/employees/{employee}', [EmployeeController::class, 'update']);
            Route::delete('/employees/{employee}', [EmployeeController::class, 'destroy']);

            Route::post('/employment-types', [EmploymentTypeController::class, 'store']);
            Route::put('/employment-types/{employmentType}', [EmploymentTypeController::class, 'update']);
            Route::delete('/employment-types/{employmentType}', [EmploymentTypeController::class, 'destroy']);

            Route::post('/departments', [DepartmentController::class, 'store']);
            Route::put('/departments/{department}', [DepartmentController::class, 'update']);
            Route::delete('/departments/{department}', [DepartmentController::class, 'destroy']);
        });

        // Read access for Admin, Manager, & Employee (PBI-03: FR-06, PBI-04: FR-07)
        Route::middleware('role:admin,manager,employee')->group(function () {
            Route::get('/tasks', [TaskController::class, 'index']);
            Route::get('/tasks/{task}', [TaskController::class, 'show']);

            Route::get('/task-assignments', [TaskAssignmentController::class, 'index']);
            Route::get('/task-assignments/{taskAssignment}', [TaskAssignmentController::class, 'show']);
        });

        // Write access for Admin & Manager (PBI-03: FR-06, PBI-04: FR-07, PBI-05: FR-15)
        Route::middleware('role:admin,manager')->group(function () {
            Route::post('/tasks', [TaskController::class, 'store']);
            Route::put('/tasks/{task}', [TaskController::class, 'update']);
            Route::delete('/tasks/{task}', [TaskController::class, 'destroy']);

            Route::post('/task-assignments', [TaskAssignmentController::class, 'store']);
            Route::put('/task-assignments/{taskAssignment}', [TaskAssignmentController::class, 'update']);
            Route::delete('/task-assignments/{taskAssignment}', [TaskAssignmentController::class, 'destroy']);

            Route::get('/trainings', [TrainingController::class, 'index']);
            Route::get('/trainings/{training}', [TrainingController::class, 'show']);
            Route::post('/trainings', [TrainingController::class, 'store']);
            Route::put('/trainings/{training}', [TrainingController::class, 'update']);
            Route::delete('/trainings/{training}', [TrainingController::class, 'destroy']);
        });
    });
});
