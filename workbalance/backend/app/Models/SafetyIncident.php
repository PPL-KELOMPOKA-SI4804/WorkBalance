<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SafetyIncident extends Model
{
    protected $table = 'safety_incidents';

    protected $fillable = [
        'reported_by',
        'department_id',
        'incident_date',
        'location',
        'severity',
        'description',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'incident_date' => 'date:Y-m-d',
        ];
    }

    public function reporter(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'reported_by');
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class, 'department_id');
    }
}
